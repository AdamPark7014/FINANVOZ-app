import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Movimiento de la interfaz (dirección B+ «Viva», D0): ligero, con `Animated` y el driver nativo, y apagado si la
 * persona pidió «Reducir movimiento» en el teléfono (`02 §15`).
 */
export function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(false);
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (vigente) setReducir(v === true);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReducir(v));
    return () => {
      vigente = false;
      sub?.remove();
    };
  }, []);
  return reducir;
}

/**
 * Ciclo infinito 0 → 1 → 0 en `duracion` ms (se detiene al desmontar, si `activo` es falso o si se reduce el
 * movimiento; entonces se queda en 0).
 */
export function useCiclo(activo: boolean, duracion: number, retraso = 0): Animated.Value {
  const reducir = useReducirMovimiento();
  const [valor] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!activo || reducir) {
      valor.setValue(0);
      return;
    }
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.delay(retraso),
        Animated.timing(valor, {
          toValue: 1,
          duration: duracion / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(valor, {
          toValue: 0,
          duration: duracion / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [activo, reducir, duracion, retraso, valor]);
  return valor;
}

/** Rampa infinita 0 → 1 (vuelve a 0 de golpe): las ondas que salen del orbe al escuchar. */
export function useRampa(activo: boolean, duracion: number, retraso = 0): Animated.Value {
  const reducir = useReducirMovimiento();
  const [valor] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!activo || reducir) {
      valor.setValue(0);
      return;
    }
    // El retraso va una sola vez: todas las ondas comparten periodo y quedan escalonadas.
    const ciclo = Animated.sequence([
      Animated.delay(retraso),
      Animated.loop(
        Animated.timing(valor, {
          toValue: 1,
          duration: duracion,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        { resetBeforeIteration: true },
      ),
    ]);
    ciclo.start();
    return () => ciclo.stop();
  }, [activo, reducir, duracion, retraso, valor]);
  return valor;
}

/**
 * Entrada 0 → 1 una sola vez al montar (pase de pulido, 22-11): barras que crecen, tarjetas que aparecen. Con
 * «Reducir movimiento» se queda en 1 desde el principio.
 */
export function useEntrada(duracion = 520, retraso = 0): Animated.Value {
  const [valor] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let vigente = true;
    let anim: Animated.CompositeAnimation | null = null;
    const arrancar = (reducir: boolean) => {
      if (!vigente) return;
      if (reducir) {
        valor.setValue(1);
        return;
      }
      anim = Animated.timing(valor, {
        toValue: 1,
        duration: duracion,
        delay: retraso,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start();
    };
    const consulta = AccessibilityInfo.isReduceMotionEnabled?.();
    if (consulta) consulta.then((v) => arrancar(v === true)).catch(() => arrancar(false));
    else arrancar(false);
    return () => {
      vigente = false;
      anim?.stop();
      valor.setValue(1);
    };
  }, [duracion, retraso, valor]);
  return valor;
}
