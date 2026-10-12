/** Configuración pública del proyecto de Supabase (`expo.extra` en app.config / app.json). */
export interface ConfigNube {
  readonly url: string;
  readonly llaveAnonima: string;
}

/**
 * Lee `supabaseUrl` y `supabaseAnonKey` de `extra`. Si falta cualquiera (o la URL no es https), el nivel nube
 * queda apagado y todo lo que el nivel 0 no cubre se guarda "por interpretar". No hay valores por omisión: la
 * app no trae ningún proyecto escrito en el código.
 */
export function leerConfigNube(extra: unknown): ConfigNube | null {
  if (!extra || typeof extra !== 'object') return null;
  const { supabaseUrl, supabaseAnonKey } = extra as Record<string, unknown>;
  if (typeof supabaseUrl !== 'string' || typeof supabaseAnonKey !== 'string') return null;
  const url = supabaseUrl.trim();
  const llaveAnonima = supabaseAnonKey.trim();
  if (!/^https:\/\/[^\s/]+/.test(url) || llaveAnonima === '') return null;
  return { url, llaveAnonima };
}
