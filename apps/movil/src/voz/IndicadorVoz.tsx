import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTema } from '../ui/tema';
import { useReducirMovimiento } from './useVozAsistente';

/** Altura relativa de cada barra en reposo y su retraso al ondular. */
const BARRAS = [0.45, 0.75, 1, 0.75, 0.45] as const;
const RETRASO_MS = 110;
const CICLO_MS = 420;

/**
 * Ondas de voz (decorativas) mientras el asistente escucha o habla: cinco barras con el color de acento. Con
 * «Reducir movimiento» se quedan quietas (el estado lo dicen el micrófono y su etiqueta, no la animación). Oculto
 * para VoiceOver y TalkBack.
 */
export function IndicadorVoz({
  activo,
  alto = 28,
  testID,
}: {
  /** Escuchando o hablando: ondula. */
  activo: boolean;
  alto?: number;
  testID?: string;
}) {
  const { c } = useTema();
  const reducir = useReducirMovimiento();
  const animar = activo && !reducir;
  const [escalas] = useState(() => BARRAS.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (!animar) {
      escalas.forEach((e) => e.setValue(1));
      return;
    }
    const ondas = escalas.map((e, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RETRASO_MS),
          Animated.timing(e, {
            toValue: 1.6,
            duration: CICLO_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(e, {
            toValue: 0.7,
            duration: CICLO_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    ondas.forEach((o) => o.start());
    return () => ondas.forEach((o) => o.stop());
  }, [animar, escalas]);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: alto, flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      {BARRAS.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            height: Math.round((alto / 1.6) * h),
            borderRadius: 2,
            backgroundColor: c.acento,
            opacity: activo ? 1 : 0.4,
            transform: [{ scaleY: escalas[i] ?? 1 }],
          }}
        />
      ))}
    </View>
  );
}
