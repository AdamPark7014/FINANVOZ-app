import Constants from 'expo-constants';
import { getRandomBytes } from 'expo-crypto';
import { catalogoApp } from '../captura/catalogo';
import { ANALITICA_APAGADA, crearAnalitica, type Analitica } from './cliente';
import { leerConfigPosthog, transportePosthog } from './posthog';

/**
 * Analítica de la app: PostHog si la build trae `extra.posthogKey` o `EXPO_PUBLIC_POSTHOG_KEY` (se inyecta al
 * compilar, nunca se guarda en el repositorio); si no, una que no envía nada. Aun con llave, nada sale sin el
 * opt-in de estadísticas.
 */
export function crearAnaliticaExpo(): Analitica {
  const config = leerConfigPosthog(Constants.expoConfig?.extra, process.env.EXPO_PUBLIC_POSTHOG_KEY);
  if (!config) return ANALITICA_APAGADA;
  return crearAnalitica({
    transporte: transportePosthog(config),
    aleatorio: getRandomBytes,
    bancosPermitidos: new Set(catalogoApp().bancos.map((b) => b.id)),
  });
}
