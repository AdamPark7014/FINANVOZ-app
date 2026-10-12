const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Carga (claims) de un JWT, sin verificar la firma. `null` si no se puede leer. */
function cargaDeToken(jwt: string): Record<string, unknown> | null {
  const carga = jwt.split('.')[1];
  if (!carga) return null;
  try {
    const base64 = carga
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(carga.length / 4) * 4, '=');
    const datos: unknown = JSON.parse(atob(base64));
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Id del usuario (`sub`) de un JWT de Supabase, sin verificar la firma: solo sirve para decirle a RevenueCat a qué
 * usuario anónimo pertenecen las compras (el proxy verifica el JWT por su cuenta). `null` si no es un uuid.
 */
export function usuarioDeToken(jwt: string): string | null {
  const sub = cargaDeToken(jwt)?.sub;
  return typeof sub === 'string' && UUID.test(sub) ? sub.toLowerCase() : null;
}

/** Lo que la app necesita saber de su sesión para el respaldo en la nube (sin verificar la firma). */
export interface ClaimsSesion {
  readonly usuarioId: string;
  /** `true` solo si la sesión es de correo: `is_anonymous: false` y un `email`. */
  readonly conCorreo: boolean;
  /** Correo de la cuenta de respaldo; solo se muestra en el teléfono, nunca se registra (regla 9). */
  readonly correo: string | null;
}

export function claimsDeToken(jwt: string): ClaimsSesion | null {
  const usuarioId = usuarioDeToken(jwt);
  const carga = cargaDeToken(jwt);
  if (usuarioId === null || carga === null) return null;
  const correo = typeof carga.email === 'string' && carga.email.includes('@') ? carga.email : null;
  return { usuarioId, conCorreo: carga.is_anonymous === false && correo !== null, correo };
}
