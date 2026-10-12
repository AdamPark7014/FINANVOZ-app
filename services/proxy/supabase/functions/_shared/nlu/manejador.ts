// Manejador de `POST /nlu/interpretar` (Edge Function `nlu-interpretar`). Todo lo que toca red o base se inyecta:
// la Edge Function conecta Supabase y los proveedores; las pruebas, dobles (CA-M3-04).
import {
  type CodigoError,
  type ContextoMinimo,
  CUERPO_MAXIMO_BYTES,
  ESTADO_POR_ERROR,
  type RespuestaInterpretar,
  validarSolicitud,
} from './contrato.ts';
import type { ResultadoInterpretar } from './interpretar.ts';
import type { ResultadoCupo } from './limites.ts';
import type { EventoRegistro, Registrador } from './registro.ts';

export const ENDPOINT = '/nlu/interpretar';

export interface DependenciasManejador {
  /** `false` si faltan secretos (llaves de proveedor, tope global, sal): responde 503. */
  configurado: boolean;
  /** Id del usuario de un JWT de Supabase válido (sesión anónima o de correo); `null` si no es válido. */
  verificarUsuario(jwt: string): Promise<string | null>;
  consumirCupo(usuarioId: string): Promise<ResultadoCupo>;
  /** Devuelve la interpretación consumida cuando el proveedor falló (502/504): no cuenta contra el usuario. */
  devolverCupo(usuarioId: string): Promise<void>;
  interpretar(texto: string, contexto: ContextoMinimo): Promise<ResultadoInterpretar>;
  hashUsuario(usuarioId: string): Promise<string>;
  registrar: Registrador;
}

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function crearManejador(deps: DependenciasManejador): (req: Request) => Promise<Response> {
  return async (req) => {
    let usuarioHash: string | null = null;
    const error = (codigo: CodigoError, extra: Partial<EventoRegistro> = {}) => {
      const estado = ESTADO_POR_ERROR[codigo];
      deps.registrar({
        usuario_hash: usuarioHash,
        endpoint: ENDPOINT,
        codigo,
        estado_http: estado,
        ...extra,
      });
      return responder(estado, { error: codigo });
    };

    try {
      if (req.method !== 'POST') return error('metodo');
      if (!deps.configurado) return error('sin_configurar');

      const autorizacion = req.headers.get('authorization') ?? '';
      const jwt = /^Bearer\s+(\S+)$/i.exec(autorizacion)?.[1];
      if (jwt === undefined) return error('no_autorizado');
      const usuarioId = await deps.verificarUsuario(jwt).catch(() => null);
      if (usuarioId === null) return error('no_autorizado');
      usuarioHash = await deps.hashUsuario(usuarioId);

      const crudo = await req.text();
      if (new TextEncoder().encode(crudo).length > CUERPO_MAXIMO_BYTES) return error('solicitud_invalida');
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(crudo);
      } catch {
        return error('solicitud_invalida');
      }
      const solicitud = validarSolicitud(cuerpo);
      if (solicitud === null) return error('solicitud_invalida');

      const cupo = await deps.consumirCupo(usuarioId);
      if (cupo !== 'ok') return error(cupo);

      const r = await deps.interpretar(solicitud.texto, solicitud.contexto_min);
      const metadatos = {
        proveedor: r.proveedor,
        modelo: r.modelo,
        tokens_entrada: r.tokens_entrada,
        tokens_salida: r.tokens_salida,
        latencia_ms: r.latencia_ms,
        llamadas: r.llamadas,
      };
      if (!r.ok) {
        await deps.devolverCupo(usuarioId).catch(() => undefined);
        return error(r.codigo, { ...metadatos, estado_proveedor: r.estado_proveedor });
      }

      deps.registrar({
        usuario_hash: usuarioHash,
        endpoint: ENDPOINT,
        codigo: r.desenlace,
        estado_http: 200,
        ...metadatos,
      });
      const respuesta: RespuestaInterpretar = {
        interpretacion: r.interpretacion,
        proveedor: r.proveedor,
        modelo: r.modelo,
        tokens_entrada: r.tokens_entrada,
        tokens_salida: r.tokens_salida,
        latencia_ms: r.latencia_ms,
      };
      return responder(200, respuesta);
    } catch {
      // Nunca se registra el error: su mensaje podría contener datos de la petición.
      return error('error_interno');
    }
  };
}
