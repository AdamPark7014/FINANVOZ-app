import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Llave propia para no pisar otras pantallas que también impidan capturas. */
export const LLAVE_MULTITAREA = 'finanvoz-ocultar-multitarea';

export interface ControlCaptura {
  ocultar(): Promise<void>;
  mostrar(): Promise<void>;
}

/** Difuminado máximo en el selector de apps de iOS (por omisión Expo usa 0.5, que deja leer cifras grandes). */
export const INTENSIDAD_DIFUMINADO_IOS = 1;

/**
 * Android: `FLAG_SECURE` (preventScreenCaptureAsync): la vista previa de recientes sale en blanco
 * y tampoco se permiten capturas de pantalla. iOS: difumina al máximo la vista del selector de apps; las capturas
 * de pantalla siguen permitidas (iOS no deja bloquearlas), así que el texto de Ajustes no lo promete.
 */
export const capturaExpo: ControlCaptura = {
  async ocultar() {
    if (Platform.OS === 'ios')
      await ScreenCapture.enableAppSwitcherProtectionAsync(INTENSIDAD_DIFUMINADO_IOS);
    else await ScreenCapture.preventScreenCaptureAsync(LLAVE_MULTITAREA);
  },
  async mostrar() {
    if (Platform.OS === 'ios') await ScreenCapture.disableAppSwitcherProtectionAsync();
    else await ScreenCapture.allowScreenCaptureAsync(LLAVE_MULTITAREA);
  },
};

/** "Ocultar en multitarea" (RF-CFG-03, CA-M2-11): aplica la preferencia mientras está montado. */
export function useOcultarEnMultitarea(activo: boolean, control: ControlCaptura = capturaExpo) {
  useEffect(() => {
    if (!activo) return;
    // Un fallo aquí no debe tumbar la app; la opción simplemente no surte efecto.
    control.ocultar().catch(() => {});
    return () => {
      control.mostrar().catch(() => {});
    };
  }, [activo, control]);
}
