/**
 * Arma el nivel nube en el teléfono: configuración de `expo.extra`, sesión anónima con los tokens en
 * expo-secure-store, cliente del proxy con `fetch` y conectividad con expo-network. Sin configuración devuelve
 * `null` y la app funciona igual que en M2 (todo lo que el nivel 0 no cubre queda "por interpretar").
 */
import Constants from 'expo-constants';
import { crearClienteNube } from '@cartera/nlu';
import { almacenExpo } from '../db/expo';
import type { NivelNube } from '../servicios';
import { leerConfigNube } from './config';
import { conectividadExpo } from './conectividad';
import { crearSesionNube } from './sesion';

export function crearNivelNubeExpo(): NivelNube | null {
  const config = leerConfigNube(Constants.expoConfig?.extra);
  if (!config) return null;
  const sesion = crearSesionNube({
    url: config.url,
    llaveAnonima: config.llaveAnonima,
    almacen: almacenExpo,
  });
  return {
    cliente: crearClienteNube({ url: config.url, obtenerToken: (o) => sesion.obtenerToken(o) }),
    conectividad: conectividadExpo,
  };
}
