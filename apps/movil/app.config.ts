import type { ExpoConfig, ConfigContext } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo as ExpoConfig;

/** Toma una variable de entorno; cadena vacía → no se incluye en `extra`. */
function cadena(entorno: string | undefined): string | undefined {
  const t = entorno?.trim();
  return t === '' ? undefined : t;
}

/**
 * Valores públicos de la build (EAS o `.env` local). Nunca hardcodear secretos aquí.
 *
 * Prueba rápida (sin commitear llaves):
 *   cd apps/movil
 *   set EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
 *   set EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   npx expo config --type public
 * Revisa `extra`: deben aparecer `supabaseUrl` y `supabaseAnonKey`. Sin variables, la nube queda apagada
 * (`leerConfigNube` → null) y el APK de CI sigue sin nivel nube, como en `.github/workflows/apk.yml`.
 * Tras `eas init`, define `EAS_PROJECT_ID` en el entorno de EAS; si falta, queda el marcador de abajo.
 */
function llenarExtra(): Record<string, unknown> {
  const extra: Record<string, unknown> = {
    eas: {
      projectId: cadena(process.env.EAS_PROJECT_ID) ?? 'REPLACE_WITH_EAS_PROJECT_ID',
    },
  };

  const supabaseUrl = cadena(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = cadena(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const sentryDsn = cadena(process.env.EXPO_PUBLIC_SENTRY_DSN);
  const posthogKey = cadena(process.env.EXPO_PUBLIC_POSTHOG_KEY);
  const posthogHost = cadena(process.env.EXPO_PUBLIC_POSTHOG_HOST);

  if (supabaseUrl) extra.supabaseUrl = supabaseUrl;
  if (supabaseAnonKey) extra.supabaseAnonKey = supabaseAnonKey;
  if (sentryDsn) extra.sentryDsn = sentryDsn;
  if (posthogKey) extra.posthogKey = posthogKey;
  if (posthogHost) extra.posthogHost = posthogHost;

  // «Plus de prueba» sin tienda (`src/servicios/plan.ts`): solo builds de prueba (TestFlight, prueba interna de
  // Play, APK). Siempre booleano y siempre desde aquí, para que `app.json` nunca pueda encenderlo.
  extra.plusSinTienda = plusSinTienda(process.env.EXPO_PUBLIC_PLUS_SIN_TIENDA);

  return extra;
}

/** Solo `'1'` enciende el Plus de prueba; cualquier otro valor (`'true'`, `'0'`, vacío) lo deja apagado. */
export function plusSinTienda(entorno: string | undefined): boolean {
  return cadena(entorno) === '1';
}

/**
 * Versión y número de build de la tienda (sentada 8, pendiente 109). Por omisión los de `app.json`; los flujos
 * «iOS · TestFlight» y «Android · Play» los pasan por variable para no commitear un número por cada subida:
 *   APP_VERSION       → `version` (CFBundleShortVersionString / versionName), p. ej. 1.0.0
 *   APP_BUILD_NUMBER  → `ios.buildNumber` y `android.versionCode` (entero creciente; Play nunca repite uno)
 */
function versionDeTienda(): Pick<ExpoConfig, 'version' | 'ios' | 'android'> {
  const version = cadena(process.env.APP_VERSION) ?? base.version;
  const build = cadena(process.env.APP_BUILD_NUMBER);
  const versionCode = build && /^\d+$/.test(build) ? Number(build) : base.android?.versionCode;
  const buildNumber = build ?? base.ios?.buildNumber;
  // Sin valor, la clave no se escribe (igual que `undefined` al serializar; así lo pide exactOptionalPropertyTypes).
  return {
    ...(version !== undefined ? { version } : {}),
    ios: { ...base.ios, ...(buildNumber !== undefined ? { buildNumber } : {}) },
    android: { ...base.android, ...(versionCode !== undefined ? { versionCode } : {}) },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...base,
  ...config,
  ...versionDeTienda(),
  extra: {
    ...(typeof base.extra === 'object' && base.extra !== null ? base.extra : {}),
    ...(typeof config.extra === 'object' && config.extra !== null ? config.extra : {}),
    ...llenarExtra(),
  },
});
