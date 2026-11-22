import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReducirMovimiento } from '../movimiento';
import { useTema } from '../tema';
import { radio } from '../tokens';

export interface BarraProps {
  /** Lo lleno, en puntos base (0–10 000); lo que pase de 10 000 se dibuja lleno. */
  llenoBp: number;
  /** Marca vertical opcional (p. ej. el 30 % de uso recomendado), en puntos base. */
  marcaBp?: number;
  /**
   * De dónde arranca lo lleno al aparecer (puntos base): la barra crece hasta `llenoBp` (el avance del recorrido
   * inicial). Sin esto, o con «Reducir movimiento», se pinta de una vez.
   */
  desdeBp?: number;
  /** Lo que dice TalkBack: la barra nunca es la única forma de leer el dato (`02 §15`). */
  etiquetaAccesible: string;
  alto?: number;
  /** Colores propios sobre una superficie de color (p. ej. la placa violeta de la tarjeta de crédito). */
  colores?: { readonly riel: string; readonly lleno: string; readonly marca: string };
  testID?: string;
}

const acotar = (bp: number) => Math.max(0, Math.min(10000, bp)) / 100;

/** Barra horizontal sobria (`02 §16`: las barras viven en Tarjetas y Cuentas). Solo dibuja lo que recibe. */
export function Barra({ llenoBp, marcaBp, desdeBp, etiquetaAccesible, alto = 12, colores, testID }: BarraProps) {
  const { c } = useTema();
  const reducir = useReducirMovimiento();
  const porcentaje = Math.round(acotar(llenoBp));
  const [avance] = useState(() => new Animated.Value(acotar(desdeBp ?? llenoBp)));
  useEffect(() => {
    if (desdeBp === undefined || reducir) {
      avance.setValue(acotar(llenoBp));
      return;
    }
    const animacion = Animated.timing(avance, {
      toValue: acotar(llenoBp),
      duration: 420,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      // El ancho no lo anima el hilo nativo; es una barra y dura menos de medio segundo.
      useNativeDriver: false,
    });
    animacion.start();
    return () => animacion.stop();
  }, [avance, desdeBp, llenoBp, reducir]);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiquetaAccesible}
      accessibilityValue={{ min: 0, max: 100, now: porcentaje, text: `${porcentaje}%` }}
      style={{
        height: alto,
        borderRadius: radio.pastilla,
        backgroundColor: colores?.riel ?? c.superficieAlterna,
        borderWidth: 0,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: avance.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          height: '100%',
          backgroundColor: colores?.lleno ?? c.acento,
          borderRadius: radio.pastilla,
        }}
      />
      {marcaBp !== undefined ? (
        <View
          style={{
            position: 'absolute',
            left: `${acotar(marcaBp)}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: colores?.marca ?? c.texto,
          }}
        />
      ) : null}
    </View>
  );
}