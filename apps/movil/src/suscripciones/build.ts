/**
 * Lo que la build dice del plan, aparte de `expo.ts` (las compras): las pruebas de pantalla simulan las compras
 * reemplazando `expo.ts` y `ProveedorPlan` igual tiene que poder leer esto.
 */
import Constants from 'expo-constants';
import { leerPlusSinTienda } from './config';

/** La build pide «Plus de prueba» si no hay tienda (`EXPO_PUBLIC_PLUS_SIN_TIENDA=1` → `extra.plusSinTienda`). */
export function plusSinTiendaDeLaBuild(): boolean {
  return leerPlusSinTienda(Constants.expoConfig?.extra);
}
