import { useCallback, useRef } from 'react';
import type { AccessibilityActionEvent, AccessibilityActionInfo } from 'react-native';

/** Un toque que dura al menos esto es "mantener presionado": al soltar se termina de escuchar. */
export const UMBRAL_MANTENER_MS = 600;

/**
 * Un mismo doble toque de TalkBack puede llegar como toque y como acción "activar": un segundo cambio dentro
 * de esta ventana se ignora para no empezar y terminar al instante.
 */
export const REBOTE_MS = 400;

const ACCIONES_HABLAR: readonly AccessibilityActionInfo[] = [{ name: 'activate' }];

export interface ControlHablar {
  /** Escuchando o terminando de procesar lo dicho. */
  escuchando: boolean;
  iniciar: () => Promise<void> | void;
  detener: () => void;
  /** Descarta lo dicho (deslizar fuera del micrófono mientras se mantiene, D2). */
  cancelar?: () => void;
}

export interface BotonHablar {
  alPresionarDentro: () => void;
  alSoltar: () => void;
  accionesAccesibles: readonly AccessibilityActionInfo[];
  alAccionAccesible: (evento: AccessibilityActionEvent) => void;
  /**
   * El dedo se deslizó fuera del micrófono mientras lo mantenía (D2: «desliza para cancelar»): descarta lo dicho en
   * vez de registrarlo. Un toque corto que dejó escuchando no se cancela así: para eso está la X.
   */
  alDeslizarFuera: () => void;
}

/**
 * "Toca para hablar, toca para terminar" (por omisión) con "mantén presionado y suelta" como alternativa.
 * El reconocedor también termina solo cuando dejas de hablar (`continuous: false`). Con TalkBack el doble toque
 * llega como la acción "activar" y alterna igual que un toque.
 */
export function useBotonHablar(
  { escuchando, iniciar, detener, cancelar }: ControlHablar,
  reloj: () => number = Date.now,
): BotonHablar {
  const ultimoCambio = useRef<number | null>(null);
  const toque = useRef<{ inicio: number; empezo: boolean; detiene: boolean } | null>(null);

  const cambiar = useCallback(
    (empezar: boolean, t: number): boolean => {
      const previo = ultimoCambio.current;
      if (previo !== null && t - previo < REBOTE_MS) return false;
      ultimoCambio.current = t;
      if (empezar) void iniciar();
      else detener();
      return true;
    },
    [iniciar, detener],
  );

  const alPresionarDentro = useCallback(() => {
    const t = reloj();
    toque.current = escuchando
      ? { inicio: t, empezo: false, detiene: true }
      : { inicio: t, empezo: cambiar(true, t), detiene: false };
  }, [cambiar, escuchando, reloj]);

  const alSoltar = useCallback(() => {
    const actual = toque.current;
    toque.current = null;
    if (!actual) return;
    const t = reloj();
    // Toque corto que empezó: sigue escuchando. Mantenido: al soltar termina. Toque mientras escucha: termina.
    if (actual.empezo ? t - actual.inicio >= UMBRAL_MANTENER_MS : actual.detiene) cambiar(false, t);
  }, [cambiar, reloj]);

  const alAccionAccesible = useCallback(
    (evento: AccessibilityActionEvent) => {
      if (evento.nativeEvent.actionName === 'activate') cambiar(!escuchando, reloj());
    },
    [cambiar, escuchando, reloj],
  );

  const alDeslizarFuera = useCallback(() => {
    const actual = toque.current;
    toque.current = null;
    if (!actual?.empezo) return;
    ultimoCambio.current = reloj();
    if (cancelar) cancelar();
    else detener();
  }, [cancelar, detener, reloj]);

  return {
    alPresionarDentro,
    alSoltar,
    accionesAccesibles: ACCIONES_HABLAR,
    alAccionAccesible,
    alDeslizarFuera,
  };
}
