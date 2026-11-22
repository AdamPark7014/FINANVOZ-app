import { requireOptionalNativeModule } from 'expo';

/**
 * Háptica de la interfaz (pase de pulido, 22-11): un toque muy ligero al elegir algo (interruptor, chip, opción) y uno
 * de aviso antes de una acción que no se deshace. Usa el módulo nativo de `expo-haptics` si la build lo trae; si no,
 * no vibra (nunca la vibración larga de `Vibration`, que en iPhone es una alerta). Es solo adorno: el estado siempre
 * se ve y se anuncia.
 */
export type GolpeInterfaz = 'eleccion' | 'ligero' | 'exito' | 'aviso';

interface ModuloHaptics {
  selectionAsync?: () => Promise<void>;
  impactAsync?: (estilo: string) => Promise<void>;
  notificationAsync?: (tipo: string) => Promise<void>;
}

let modulo: ModuloHaptics | null | undefined;

function haptics(): ModuloHaptics | null {
  if (modulo === undefined) {
    try {
      modulo = requireOptionalNativeModule<ModuloHaptics>('ExpoHaptics');
    } catch {
      modulo = null;
    }
  }
  return modulo;
}

export function golpe(tipo: GolpeInterfaz = 'eleccion'): void {
  try {
    const h = haptics();
    if (!h) return;
    const promesa =
      tipo === 'eleccion'
        ? h.selectionAsync?.()
        : tipo === 'ligero'
          ? h.impactAsync?.('light')
          : h.notificationAsync?.(tipo === 'exito' ? 'success' : 'warning');
    if (promesa) promesa.catch(() => {});
  } catch {
    // Sin motor de vibración: no pasa nada.
  }
}
