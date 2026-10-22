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

/**
 * `expo.extra.plusSinTienda`: lo pone `app.config.ts` desde `EXPO_PUBLIC_PLUS_SIN_TIENDA` (solo `'1'` lo enciende)
 * en las builds de prueba (TestFlight, prueba interna de Play, APK). Nunca vive en `app.json`. Solo `true` cuenta.
 */
export function leerPlusSinTienda(extra: unknown): boolean {
  return (
    extra !== null && typeof extra === 'object' && (extra as Record<string, unknown>).plusSinTienda === true
  );
}

/**
 * «Plus de prueba»: la build lo pide y no tiene tienda (iPhone, o Android sin llave de RevenueCat). Con tienda,
 * aunque la variable siga puesta, manda la tienda.
 */
export function modoPlusDePrueba(o: { plusSinTienda: boolean; hayTienda: boolean }): boolean {
  return o.plusSinTienda && !o.hayTienda;
}
