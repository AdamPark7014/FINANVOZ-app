/**
 * Arma el nivel nube en el teléfono: configuración de `expo.extra`, sesión anónima con los tokens en
 * expo-secure-store, cliente del proxy con `fetch` y conectividad con expo-network. Sin configuración devuelve
 * `null` y la app funciona igual que en M2 (todo lo que el nivel 0 no cubre queda "por interpretar").
 */
import Constants from 'expo-constants';
import { crearClienteNube } from '@cartera/nlu';
import { almacenExpo } from '../db/expo';
import { crearPuertoEvidencia, type PuertoEvidencia } from '../privacidad/evidencia-servidor';
import type { NivelNube, NubeRespaldo } from '../servicios';
import { leerConfigNube, type ConfigNube } from './config';
import { conectividadExpo } from './conectividad';
import { crearCuentaRespaldo } from './cuenta-respaldo';
import { crearRespaldoNube } from './respaldo-nube';
import { crearSesionNube, type SesionNube } from './sesion';
import { usuarioDeToken } from './token';

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
    usuarioId: async () => {
      const token = await sesion.obtenerToken();
      return token ? usuarioDeToken(token) : null;
    },
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

/**
 * Cuenta de respaldo (correo y código) y cliente del bucket `respaldos` (M9) sobre la misma sesión que el resto
 * de la app; `null` sin configuración (la pantalla de respaldo solo ofrece archivos).
 */
export function crearNubeRespaldoExpo(): NubeRespaldo | null {
  const config = leerConfigNube(Constants.expoConfig?.extra);
  if (!config) return null;
  const sesion = sesionNubeExpo(config);
  return {
    cuenta: crearCuentaRespaldo({
      url: config.url,
      llaveAnonima: config.llaveAnonima,
      almacen: almacenExpo,
      sesion,
    }),
    respaldos: crearRespaldoNube({ url: config.url, sesion }),
  };
}
