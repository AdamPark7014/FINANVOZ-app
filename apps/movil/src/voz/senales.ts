import { requireOptionalNativeModule } from 'expo';
import { Platform, Vibration } from 'react-native';

/**
 * Señal táctil al empezar y al terminar de escuchar (sin sonido: no se cuela en lo que se graba).
 *
 * - Android: `Vibration` de React Native (el permiso `VIBRATE` ya va en el manifiesto de Expo): un toque de 18 ms al
 *   empezar y dos muy cortos al terminar, para distinguirlos sin mirar.
 * - iPhone: un golpe ligero de Taptic Engine si el módulo nativo de `expo-haptics` está en la build. Sin él no vibra:
 *   `Vibration` en iPhone es siempre la alerta de 0.4 s, que no es una señal ligera.
 */
export type SenalEscucha = 'inicio' | 'fin';

export const VIBRACION_ANDROID: Readonly<Record<SenalEscucha, number | number[]>> = {
  inicio: 18,
  fin: [0, 12, 70, 12],
};

/** Estilo de `impactAsync` de expo-haptics por señal. */
export const GOLPE_IOS: Readonly<Record<SenalEscucha, 'light' | 'soft'>> = { inicio: 'light', fin: 'soft' };

interface ModuloHaptics {
  impactAsync?: (estilo: string) => Promise<void>;
}

let haptics: ModuloHaptics | null | undefined;

function moduloHaptics(): ModuloHaptics | null {
  if (haptics === undefined) {
    try {
      haptics = requireOptionalNativeModule<ModuloHaptics>('ExpoHaptics');
    } catch {
      haptics = null;
    }
  }
  return haptics;
}

export function senalEscucha(senal: SenalEscucha): void {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(VIBRACION_ANDROID[senal]);
      return;
    }
    if (Platform.OS === 'ios') {
      const golpe = moduloHaptics()?.impactAsync?.(GOLPE_IOS[senal]);
      if (golpe) golpe.catch(() => {});
    }
  } catch {
    // Sin vibrador o sin módulo: la señal es opcional (el estado también se ve y se anuncia).
  }
}
