// Manejador de `POST /llm/turno` (Edge Function `llm-turno`, M10). JWT → cuerpo → cupo de Plus → turno →
// respuesta. Todo lo que toca red o base se inyecta. Registro solo de metadatos (regla 9): nunca la pregunta, los
// resultados de herramientas, los argumentos ni el texto del modelo.
import type { ResultadoCupo } from '../nlu/limites.ts';
import type { EventoRegistro, Registrador } from '../nlu/registro.ts';
import {
  contarResultados,
  type CodigoError,
  CUERPO_MAXIMO_BYTES,
  ESTADO_POR_ERROR,
  type RespuestaTurno,
  type SolicitudTurno,
  validarSolicitud,
} from './contrato.ts';
import type { ResultadoTurno } from './turno.ts';

export const ENDPOINT = '/llm/turno';

export type ResultadoCupoTurno = ResultadoCupo | 'solo_plus';

export interface DependenciasManejadorTurno {
  /** `false` si faltan secretos (llaves de proveedor, tope global, sal): responde 503. */
  configurado: boolean;
  verificarUsuario(jwt: string): Promise<string | null>;
  /** `consumir_turno_llm`: Plus vigente y una interpretación del cupo por turno. */
  consumirCupo(usuarioId: string): Promise<ResultadoCupoTurno>;
  /** Devuelve el turno consumido cuando el proveedor falló (502/504). */
  devolverCupo(usuarioId: string): Promise<void>;
  turno(solicitud: SolicitudTurno): Promise<ResultadoTurno>;
  hashUsuario(usuarioId: string): Promise<string>;
  registrar: Registrador;
}

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function crearManejadorTurno(deps: DependenciasManejadorTurno): (req: Request) => Promise<Response> {
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

      const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
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
      const resultadosHerramienta = contarResultados(solicitud.mensajes);

      const cupo = await deps.consumirCupo(usuarioId);
      if (cupo !== 'ok') return error(cupo, { resultados_herramienta: resultadosHerramienta });

      const r = await deps.turno(solicitud);
      const metadatos = {
        proveedor: r.proveedor,
        modelo: r.modelo,
        tokens_entrada: r.tokens_entrada,
        tokens_salida: r.tokens_salida,
        latencia_ms: r.latencia_ms,
        llamadas: r.llamadas,
        resultados_herramienta: resultadosHerramienta,
      };
      if (!r.ok) {
        await deps.devolverCupo(usuarioId).catch(() => undefined);
        return error(r.codigo, { ...metadatos, estado_proveedor: r.estado_proveedor });
      }

      deps.registrar({
        usuario_hash: usuarioHash,
        endpoint: ENDPOINT,
        codigo: r.salida.tipo,
        estado_http: 200,
        ...metadatos,
      });
      const respuesta: RespuestaTurno = {
        salida: r.salida,
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

const RESULTADOS = new Set<string>(['ok', 'solo_plus', 'limite_diario', 'limite_mensual', 'tope_global']);
export const esResultadoCupoTurno = (v: unknown): v is ResultadoCupoTurno =>
  typeof v === 'string' && RESULTADOS.has(v);
