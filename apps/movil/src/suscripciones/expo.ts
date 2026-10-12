/**
 * Arma las compras en el teléfono: RevenueCat con la llave pública de la build (Android). Sin llave, en builds de
 * desarrollo se usa la tienda simulada para poder recorrer la pantalla del plan; en producción no hay compras y
 * la cuenta se queda en Gratis (nada se bloquea).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { leerLlaveRevenueCat } from './config';
import { crearComprasEnMemoria } from './memoria';
import { crearComprasRevenueCat, type ModuloPurchases } from './revenuecat';
import type { AdaptadorCompras } from './tipos';

export function crearComprasExpo(): AdaptadorCompras | null {
  const llave = leerLlaveRevenueCat(
    Constants.expoConfig?.extra,
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  );
  if (!llave || Platform.OS !== 'android') return __DEV__ ? crearComprasEnMemoria() : null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa del módulo nativo
    const modulo = (require('react-native-purchases') as { default: unknown }).default;
    return crearComprasRevenueCat(modulo as ModuloPurchases, llave);
  } catch {
    // Sin el módulo nativo (Expo Go): sin compras.
    return null;
  }
}
