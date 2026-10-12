/**
 * Llave pública del SDK de RevenueCat para Android (`goog_…`). Sale de `expo.extra.revenuecatAndroidKey` o de
 * `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` al construir la app (`.env` o secretos de EAS); nunca se escribe en el
 * código. Una llave secreta (`sk_…`) se rechaza: esa solo puede vivir en un servidor.
 */
export function leerLlaveRevenueCat(extra: unknown, entorno: string | undefined): string | null {
  const deExtra =
    extra && typeof extra === 'object' ? (extra as Record<string, unknown>).revenuecatAndroidKey : undefined;
  const llave = (typeof deExtra === 'string' && deExtra.trim() !== '' ? deExtra : (entorno ?? '')).trim();
  return /^(goog|test)_[A-Za-z0-9]+$/.test(llave) ? llave : null;
}
