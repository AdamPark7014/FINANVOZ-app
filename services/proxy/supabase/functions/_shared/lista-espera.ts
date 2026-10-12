// Contrato de la lista de espera de M0 (`docs/08-CUMPLIMIENTO.md §2.1`). Puro: lo usa la Edge Function
// (Deno) y se prueba con Vitest en Node. La calculadora repite estas opciones en `ListaEspera.tsx`.

export const OPCIONES = {
  telefono: ['android', 'iphone'],
  notificaciones: ['si', 'a_veces', 'no', 'no_se'],
  precio: ['0', 'hasta_49', '50_99', '100_mas'],
  uso: ['personal', 'negocio', 'contador'],
} as const;

export type Respuestas = { [K in keyof typeof OPCIONES]: (typeof OPCIONES)[K][number] };

export interface SolicitudValida {
  correo: string;
  respuestas: Respuestas;
  versionAviso: string;
}

export type Validacion =
  | { tipo: 'valida'; solicitud: SolicitudValida }
  /** El campo trampa vino lleno: se responde como si se hubiera guardado, sin guardar nada. */
  | { tipo: 'bot' }
  | {
      tipo: 'invalida';
      codigo: 'sin_consentimiento' | 'correo_invalido' | 'respuestas_invalidas' | 'formato';
    };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VERSION = /^[\w.-]{1,32}$/;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validarSolicitud(cuerpo: unknown): Validacion {
  if (!esObjeto(cuerpo)) return { tipo: 'invalida', codigo: 'formato' };
  if (typeof cuerpo['sitio_web'] === 'string' && cuerpo['sitio_web'].trim() !== '') return { tipo: 'bot' };
  if (cuerpo['consentimiento'] !== true) return { tipo: 'invalida', codigo: 'sin_consentimiento' };

  const correo = typeof cuerpo['correo'] === 'string' ? cuerpo['correo'].trim().toLowerCase() : '';
  if (correo.length > 254 || !CORREO.test(correo)) return { tipo: 'invalida', codigo: 'correo_invalido' };

  const versionAviso = cuerpo['version_aviso'];
  if (typeof versionAviso !== 'string' || !VERSION.test(versionAviso))
    return { tipo: 'invalida', codigo: 'formato' };

  const r = cuerpo['respuestas'];
  if (!esObjeto(r)) return { tipo: 'invalida', codigo: 'respuestas_invalidas' };
  const claves = Object.keys(OPCIONES) as (keyof typeof OPCIONES)[];
  if (Object.keys(r).length !== claves.length) return { tipo: 'invalida', codigo: 'respuestas_invalidas' };
  for (const clave of claves) {
    if (!(OPCIONES[clave] as readonly unknown[]).includes(r[clave])) {
      return { tipo: 'invalida', codigo: 'respuestas_invalidas' };
    }
  }
  return { tipo: 'valida', solicitud: { correo, respuestas: r as Respuestas, versionAviso } };
}

/** Primera IP de `x-forwarded-for` (la pone el borde de Supabase); vacío si no hay. */
export function ipCliente(encabezados: Headers): string {
  return encabezados.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

/** Huella irreversible de la IP con sal secreta: no se guarda la IP (aviso de privacidad). */
export async function huellaIp(ip: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
