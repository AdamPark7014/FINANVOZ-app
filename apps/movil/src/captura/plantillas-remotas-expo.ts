/**
 * Configuración de las plantillas remotas en el teléfono (`07 §3.1`): llaves públicas del build
 * (`EXPO_PUBLIC_PLANTILLAS_LLAVES`, `id:hex` separados por coma, en `.env` o secretos de EAS; nunca en el código),
 * URL del bucket público del proyecto de Supabase (`expo.extra`) y versión de la app. Sin llaves o sin proyecto
 * devuelve `null`: la captura sigue con las plantillas embebidas.
 *
 * Un build de depuración puede configurar la llave pública de prueba de RFC 8032 (la de
 * `fixtures/plantillas-firmadas/`); uno de producción la descarta y el escaneo del bundle la rechaza (CA-M10-04).
 */
import Constants from 'expo-constants';
import { leerConfigNube } from '../nube/config';
import { fetchPlataforma } from '../nube/http';
import { urlPlantillas, type DependenciasPlantillas } from './actualizar-plantillas';
import { leerLlavesPlantillas } from './plantillas-remotas';

export function crearPlantillasRemotasExpo(): DependenciasPlantillas | null {
  const llaves = leerLlavesPlantillas(process.env.EXPO_PUBLIC_PLANTILLAS_LLAVES, { produccion: !__DEV__ });
  const config = leerConfigNube(Constants.expoConfig?.extra);
  if (llaves.length === 0 || !config) return null;
  return {
    llaves,
    versionApp: Constants.expoConfig?.version ?? '0.0.0',
    url: urlPlantillas(config.url),
    fetch: fetchPlataforma,
  };
}
