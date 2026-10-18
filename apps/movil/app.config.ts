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

  return extra;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...base,
  ...config,
  extra: {
    ...(typeof base.extra === 'object' && base.extra !== null ? base.extra : {}),
    ...(typeof config.extra === 'object' && config.extra !== null ? config.extra : {}),
    ...llenarExtra(),
  },
});
