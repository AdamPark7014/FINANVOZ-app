import { requireOptionalNativeModule } from 'expo';

/**
 * Háptica de la interfaz: toques cortos al elegir, pulsar o avisar. Usa ExpoHaptics si la build lo trae;
 * si no, no vibra. Solo adorno: el estado siempre se ve y se anuncia.
 */

export type GolpeInterfaz = 'eleccion' | 'ligero' | 'exito' | 'aviso';

/** API del onboarding/voz: mismos motores, nombres distintos (incluye «medio» para el micrófono). */
export type Toque = 'seleccion' | 'ligero' | 'medio' | 'exito' | 'aviso';

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

export function vibrar(toque: Toque): void {
  try {
    const h = haptics();
    if (!h) return;
    const promesa =
      toque === 'seleccion'
        ? h.selectionAsync?.()
        : toque === 'ligero'
          ? h.impactAsync?.('light')
          : toque === 'medio'
            ? h.impactAsync?.('medium')
            : h.notificationAsync?.(toque === 'exito' ? 'success' : 'warning');
    if (promesa) void Promise.resolve(promesa).catch(() => undefined);
  } catch {
    // Sin motor de vibración: se queda sin vibrar.
  }
}
