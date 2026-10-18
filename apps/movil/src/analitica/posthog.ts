import type { TransporteAnalitica } from './cliente';
import { errorEnvioHttpAnalitica } from './mensajes';

/** Configuración pública de PostHog (`expo.extra` o `EXPO_PUBLIC_POSTHOG_KEY` al compilar). */
export interface ConfigPosthog {
  /** Llave pública del proyecto (`phc_…`): solo permite enviar eventos. No se guarda en el repositorio. */
  readonly llave: string;
  readonly host: string;
}

const HOST_POR_OMISION = 'https://us.i.posthog.com';

/**
 * Lee `posthogKey` (y opcionalmente `posthogHost`) de `extra`, o la llave de `EXPO_PUBLIC_POSTHOG_KEY`. Sin
 * llave no hay analítica: la app no trae ninguna escrita en el código. El host debe ser https.
 */
export function leerConfigPosthog(extra: unknown, entorno: string | undefined): ConfigPosthog | null {
  const e = extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : {};
  const llave = (typeof e.posthogKey === 'string' ? e.posthogKey : (entorno ?? '')).trim();
  if (llave === '') return null;
  const host = (typeof e.posthogHost === 'string' ? e.posthogHost.trim() : HOST_POR_OMISION).replace(
    /\/+$/,
    '',
  );
  if (!/^https:\/\/[^\s/]+$/.test(host)) return null;
  return { llave, host };
}

/**
 * Transporte sobre la API pública de captura de PostHog (`POST /capture/`) con `fetch`, sin el SDK: así no
 * hay autocaptura de pantallas ni toques, ni propiedades del dispositivo, ni cola persistente. Lo único que
 * sale es lo que entrega el cliente ya validado.
 */
export function transportePosthog(
  config: ConfigPosthog,
  fetchFn: typeof fetch = (...a) => fetch(...a),
): TransporteAnalitica {
  return async (envio) => {
    const respuesta = await fetchFn(`${config.host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.llave,
        event: envio.evento,
        distinct_id: envio.idAnonimo,
        timestamp: envio.instante,
        properties: envio.propiedades,
      }),
    });
    if (!respuesta.ok) {
      throw errorEnvioHttpAnalitica(respuesta.status);
    }
  };
}
