const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Id del usuario (`sub`) de un JWT de Supabase, sin verificar la firma: solo sirve para decirle a RevenueCat a qué
 * usuario anónimo pertenecen las compras (el proxy verifica el JWT por su cuenta). `null` si no es un uuid.
 */
export function usuarioDeToken(jwt: string): string | null {
  const carga = jwt.split('.')[1];
  if (!carga) return null;
  try {
    const base64 = carga
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(carga.length / 4) * 4, '=');
    const sub = (JSON.parse(atob(base64)) as { sub?: unknown }).sub;
    return typeof sub === 'string' && UUID.test(sub) ? sub.toLowerCase() : null;
  } catch {
    return null;
  }
}
