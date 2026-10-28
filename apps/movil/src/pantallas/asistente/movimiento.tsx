import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { espacio, radio, useTema } from '../../ui';
import { useCiclo, useReducirMovimiento } from '../../ui/movimiento';

/**
 * Movimiento sutil del asistente (entrada de turnos, onda al escuchar, «pensando»): ligero, con `Animated` y el
 * driver nativo, y apagado si la persona pidió «Reducir movimiento» en el teléfono (`02 §15`). Los ciclos viven en
 * `ui/movimiento` (también los usa el orbe).
 */
export { useReducirMovimiento };

/** Un turno nuevo entra con un desvanecido y un desplazamiento corto (180 ms); los que ya estaban, quietos. */
export function EntradaTurno({ animar, children }: { animar: boolean; children: ReactNode }) {
  const reducir = useReducirMovimiento();
  const [valor] = useState(() => new Animated.Value(animar ? 0 : 1));
  useEffect(() => {
    if (!animar) return;
    if (reducir) {
      valor.setValue(1);
      return;
    }
    Animated.timing(valor, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animar, reducir, valor]);
  return (
    <Animated.View
      style={{
        opacity: valor,
        transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Onda viva bajo la transcripción mientras escucha: nueve barras que respiran a destiempo. Decorativa. */
export function OndaVoz({ activa }: { activa: boolean }) {
  const { c } = useTema();
  const altos = [10, 22, 32, 18, 28, 14, 30, 20, 12];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="onda-voz"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 34 }}
    >
      {altos.map((alto, i) => (
        <BarraOnda key={i} alto={alto} retraso={(i * 97) % 450} activa={activa} color={c.acento} />
      ))}
    </View>
  );
}

function BarraOnda({
  alto,
  retraso,
  activa,
  color,
}: {
  alto: number;
  retraso: number;
  activa: boolean;
  color: string;
}) {
  const v = useCiclo(activa, 900, retraso);
  return (
    <Animated.View
      style={{
        width: 4,
        height: alto,
        borderRadius: radio.pastilla,
        backgroundColor: color,
        transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }],
      }}
    />
  );
}

/** «Pensando»: tres puntos que se encienden por turno mientras se interpreta. Decorativo. */
export function PuntosPensando() {
  const { c } = useTema();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: espacio.xs, alignItems: 'center' }}
    >
      {[0, 160, 320].map((retraso) => (
        <Punto key={retraso} retraso={retraso} color={c.textoSecundario} />
      ))}
    </View>
  );
}

function Punto({ retraso, color }: { retraso: number; color: string }) {
  const v = useCiclo(true, 900, retraso);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
      }}
    />
  );
}

/** Anillo que late alrededor del orbe mientras escucha. Decorativo. */
export function AnilloEscucha({
  activo,
  tamano,
  color,
}: {
  activo: boolean;
  tamano: number;
  /** Por omisión, el acento de texto (sobre el fondo); en el dock, la menta. */
  color?: string;
}) {
  const { c } = useTema();
  const v = useCiclo(activo, 1600);
  if (!activo) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        borderWidth: 2,
        borderColor: color ?? c.acentoTexto,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}
