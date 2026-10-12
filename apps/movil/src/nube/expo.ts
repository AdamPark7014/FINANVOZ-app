/**
 * Arma el nivel nube en el teléfono: configuración de `expo.extra`, sesión anónima con los tokens en
 * expo-secure-store, cliente del proxy con `fetch` y conectividad con expo-network. Sin configuración devuelve
 * `null` y la app funciona igual que en M2 (todo lo que el nivel 0 no cubre queda "por interpretar").
 */
import Constants from 'expo-constants';
import { crearClienteNube } from '@cartera/nlu';
import { almacenExpo } from '../db/expo';
import { crearPuertoEvidencia, type PuertoEvidencia } from '../privacidad/evidencia-servidor';
import type { NivelNube } from '../servicios';
import { leerConfigNube, type ConfigNube } from './config';
import { conectividadExpo } from './conectividad';
import { crearSesionNube, type SesionNube } from './sesion';

let sesionApp: SesionNube | null = null;

/** Una sola sesión anónima para todo lo que habla con Supabase (así nunca se crean dos usuarios a la vez). */
function sesionNubeExpo(config: ConfigNube): SesionNube {
  sesionApp ??= crearSesionNube({
    url: config.url,
    llaveAnonima: config.llaveAnonima,
    almacen: almacenExpo,
  });
  return sesionApp;
}

export function crearNivelNubeExpo(): NivelNube | null {
  const config = leerConfigNube(Constants.expoConfig?.extra);
  if (!config) return null;
  const sesion = sesionNubeExpo(config);
  return {
    cliente: crearClienteNube({ url: config.url, obtenerToken: (o) => sesion.obtenerToken(o) }),
    conectividad: conectividadExpo,
  };
}

/** Copia de la evidencia del consentimiento en Supabase (`08 §2`); `null` sin configuración. */
export function crearPuertoEvidenciaExpo(): PuertoEvidencia | null {
  const config = leerConfigNube(Constants.expoConfig?.extra);
  if (!config) return null;
  return crearPuertoEvidencia({
    url: config.url,
    llaveAnonima: config.llaveAnonima,
    sesion: sesionNubeExpo(config),
  });
}
