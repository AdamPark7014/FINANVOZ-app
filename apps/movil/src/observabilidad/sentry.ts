import * as Sentry from '@sentry/react-native';
import type { ReactNativeOptions } from '@sentry/react-native';
import Constants from 'expo-constants';
import { depurarEvento, depurarMiga } from './depuracion';

/**
 * Reportes de error con depuración (03 §3 y §7, RNF-05, regla 9).
 *
 * El DSN viene de `expo.extra.sentryDsn` (app.config) o de `EXPO_PUBLIC_SENTRY_DSN`; sin DSN,
 * Sentry no se inicia y nada sale del teléfono. El DSN no es un secreto (solo permite enviar).
 *
 * Límite conocido: los cierres nativos (Java/NDK) los arma el SDK nativo y no pasan por
 * `beforeSend` de JS; llevan pila, dispositivo y las migas ya depuradas que se sincronizan
 * desde JS. Por eso nada de datos de la persona en código nativo ni en migas nativas.
 */

export function leerDsn(
  extra: Record<string, unknown> | undefined = Constants.expoConfig?.extra,
  entorno: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN,
): string | null {
  const dsn = typeof extra?.sentryDsn === 'string' ? extra.sentryDsn : entorno;
  return dsn && dsn.trim() !== '' ? dsn.trim() : null;
}

export interface ConfigSentry {
  dsn: string;
  /** `development` en builds de desarrollo, `production` en tienda. */
  entorno: string;
  /** Solo para pruebas: intercepta lo que se enviaría. */
  transporte?: ReactNativeOptions['transport'];
}

export function opcionesSentry({ dsn, entorno, transporte }: ConfigSentry): ReactNativeOptions {
  return {
    dsn,
    environment: entorno,
    debug: false,
    // Nada de IP, usuario, encabezados ni cuerpos.
    sendDefaultPii: false,
    // Las capturas y el árbol de vistas mostrarían montos y comercios.
    attachScreenshot: false,
    attachViewHierarchy: false,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    // Sin rendimiento ni repeticiones de sesión: sus descripciones pueden llevar texto.
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enableCaptureFailedRequests: false,
    beforeSend: (evento, pista) => depurarEvento(evento, pista),
    beforeBreadcrumb: (miga) => depurarMiga(miga),
    beforeSendTransaction: () => null,
    ...(transporte ? { transport: transporte } : {}),
  };
}

export interface ModuloSentry {
  init(opciones: ReactNativeOptions): unknown;
}

/**
 * Inicia Sentry si hay DSN. Devuelve `true` si quedó activo.
 * Llamar una vez, antes de montar la app (en `app/_layout.tsx`).
 */
export function iniciarSentry({
  dsn = leerDsn(),
  entorno = __DEV__ ? 'development' : 'production',
  sdk = Sentry,
  transporte,
}: {
  dsn?: string | null;
  entorno?: string;
  sdk?: ModuloSentry;
  transporte?: ReactNativeOptions['transport'];
} = {}): boolean {
  if (!dsn) return false;
  sdk.init(opcionesSentry({ dsn, entorno, ...(transporte ? { transporte } : {}) }));
  return true;
}
