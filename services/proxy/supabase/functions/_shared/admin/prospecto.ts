// Contrato de captación desde la página de venta. Puro: Edge Function (Deno) y Vitest (Node).
// Privacidad: nada de nombre, correo, teléfono ni mensaje en logs.

export const INTERESES = ['plus', 'licencias', 'otro'] as const;
export type Interes = (typeof INTERESES)[number];

export interface SolicitudProspecto {
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
  interes: Interes;
  mensaje: string;
}

export type ValidacionProspecto =
  | { tipo: 'valida'; solicitud: SolicitudProspecto }
  /** Campo trampa lleno: se responde 200 sin guardar. */
  | { tipo: 'bot' }
  | {
      tipo: 'invalida';
      codigo: 'formato' | 'nombre' | 'correo' | 'interes' | 'telefono';
    };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^[0-9+\s()-]{0,20}$/;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Devuelve el texto recortado, o `null` si falta / no es string, o `'largo'` si excede. */
function texto(v: unknown, max: number): string | null | 'largo' {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length > max) return 'largo';
  return t;
}

export function validarProspecto(cuerpo: unknown): ValidacionProspecto {
  if (!esObjeto(cuerpo)) return { tipo: 'invalida', codigo: 'formato' };
  if (typeof cuerpo['sitio_web'] === 'string' && cuerpo['sitio_web'].trim() !== '') {
    return { tipo: 'bot' };
  }

  const nombre = texto(cuerpo['nombre'], 200);
  if (nombre === 'largo' || nombre === null || nombre.length < 1) {
    return { tipo: 'invalida', codigo: nombre === 'largo' ? 'formato' : 'nombre' };
  }

  const contacto = texto(cuerpo['contacto'], 200);
  if (contacto === 'largo' || contacto === null) return { tipo: 'invalida', codigo: 'formato' };

  const telefono = texto(cuerpo['telefono'], 20);
  if (telefono === 'largo' || telefono === null || !TELEFONO.test(telefono)) {
    return { tipo: 'invalida', codigo: telefono === 'largo' ? 'formato' : 'telefono' };
  }

  const correoRaw = texto(cuerpo['correo'], 254);
  if (correoRaw === 'largo' || correoRaw === null) return { tipo: 'invalida', codigo: 'formato' };
  const correo = correoRaw.toLowerCase();
  if (correo !== '' && !CORREO.test(correo)) return { tipo: 'invalida', codigo: 'correo' };

  const interes = cuerpo['interes'];
  if (typeof interes !== 'string' || !(INTERESES as readonly string[]).includes(interes)) {
    return { tipo: 'invalida', codigo: 'interes' };
  }

  const mensaje = texto(cuerpo['mensaje'], 1000);
  if (mensaje === 'largo' || mensaje === null) return { tipo: 'invalida', codigo: 'formato' };

  return {
    tipo: 'valida',
    solicitud: {
      nombre,
      contacto,
      telefono,
      correo,
      interes: interes as Interes,
      mensaje,
    },
  };
}

/** Primera IP de `x-forwarded-for`; vacío si no hay. */
export function ipCliente(encabezados: Headers): string {
  return encabezados.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

/** Huella irreversible de la IP con sal secreta. */
export async function huellaIp(ip: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Respuesta con CORS. `cuerpo` null = sin cuerpo (204). */
export function responder(estado: number, cuerpo: Record<string, unknown> | null, origen: string): Response {
  const headers: Record<string, string> = {
    'access-control-allow-origin': origen,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
  if (cuerpo !== null) headers['content-type'] = 'application/json';
  return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), { status: estado, headers });
}
