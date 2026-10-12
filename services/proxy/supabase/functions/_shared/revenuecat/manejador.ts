// Manejador de `POST /webhooks/revenuecat` (Edge Function `webhooks-revenuecat`, CA-M7-01). RevenueCat manda en
// `Authorization` el valor que se configura en su panel; aquí se exige `Bearer <REVENUECAT_WEBHOOK_SECRET>` y se
// compara en tiempo constante. La base se inyecta: la Edge Function llama a las funciones SQL; las pruebas, un doble.
import type { Registrador } from '../nlu/registro.ts';
import { type AccionDerecho, traducirEvento } from './evento.ts';

export const ENDPOINT_REVENUECAT = '/webhooks/revenuecat';
/** Los eventos pesan unos pocos KB. */
export const CUERPO_MAXIMO_WEBHOOK = 64 * 1024;
/** El secreto compartido debe ser largo (se genera aleatorio, 32 caracteres o más). */
export const LARGO_MINIMO_SECRETO = 32;

export interface DependenciasRevenueCat {
  /** `REVENUECAT_WEBHOOK_SECRET`; sin él (o corto) responde 503. */
  secreto: string | undefined;
  /** Aplica el cambio (funciones SQL atómicas); devuelve su resultado (`aplicado`, `duplicado`, …). */
  aplicar(accion: Exclude<AccionDerecho, { tipo: 'ignorar' }>): Promise<string>;
  registrar: Registrador;
}

type CodigoWebhook = 'metodo' | 'sin_configurar' | 'no_autorizado' | 'solicitud_invalida' | 'error_interno';
const ESTADO: Record<CodigoWebhook, number> = {
  metodo: 405,
  sin_configurar: 503,
  no_autorizado: 401,
  solicitud_invalida: 400,
  error_interno: 500,
};

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

/** Compara dos textos sin filtrar por el tiempo cuántos caracteres coinciden (se comparan sus SHA-256). */
export async function igualesTiempoConstante(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diferencia = 0;
  for (let i = 0; i < x.length; i++) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferencia === 0;
}

export function crearManejadorRevenueCat(deps: DependenciasRevenueCat): (req: Request) => Promise<Response> {
  return async (req) => {
    let tipoEvento = 'desconocido';
    const registrar = (codigo: string, estado: number) =>
      deps.registrar({ usuario_hash: null, endpoint: ENDPOINT_REVENUECAT, codigo, estado_http: estado });
    const error = (codigo: CodigoWebhook) => {
      registrar(codigo, ESTADO[codigo]);
      return responder(ESTADO[codigo], { error: codigo });
    };

    try {
      if (req.method !== 'POST') return error('metodo');
      const secreto = deps.secreto?.trim();
      if (!secreto || secreto.length < LARGO_MINIMO_SECRETO) return error('sin_configurar');
      const autorizacion = req.headers.get('authorization') ?? '';
      if (!(await igualesTiempoConstante(autorizacion, `Bearer ${secreto}`))) return error('no_autorizado');

      const crudo = await req.text();
      if (new TextEncoder().encode(crudo).length > CUERPO_MAXIMO_WEBHOOK) return error('solicitud_invalida');
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(crudo);
      } catch {
        return error('solicitud_invalida');
      }
      const accion = traducirEvento(cuerpo);
      if (accion === null) return error('solicitud_invalida');
      tipoEvento = /^[A-Z_]{1,40}$/.test(accion.tipoEvento) ? accion.tipoEvento : 'otro';

      if (accion.tipo === 'ignorar') {
        registrar(`${tipoEvento}:ignorado`, 200);
        return responder(200, { resultado: 'ignorado' });
      }
      const resultado = await deps.aplicar(accion);
      registrar(`${tipoEvento}:${resultado}`, 200);
      return responder(200, { resultado });
    } catch {
      // Nunca se registra el error: podría contener ids de usuario. Un 500 hace que RevenueCat reintente.
      registrar(`${tipoEvento}:error_interno`, 500);
      return responder(500, { error: 'error_interno' });
    }
  };
}
