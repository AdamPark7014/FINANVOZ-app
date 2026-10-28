import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { Centavos } from '@cartera/core';
import { formatearCentavos, type ModoCifra } from '../formato';
import { useReducirMovimiento } from '../movimiento';

/** Lo que tarda una cifra en contar hasta su valor nuevo (B+, D0). */
export const DURACION_CUENTA_MS = 700;

/**
 * Una cifra que cuenta de `desde` hasta `hasta` (dirección B+, D0: «las cifras cuentan hasta el valor nuevo, $275 →
 * $268»). Los pasos de en medio son solo animación; la cifra que se queda es `hasta`, la de `core`. Con «Reducir
 * movimiento» aparece de una vez. Quien la usa pone la etiqueta hablada (con la cifra final en palabras).
 */
export function CifraQueCuenta({
  desde,
  hasta,
  modo = 'pesos',
  style,
  testID,
}: {
  desde: Centavos;
  hasta: Centavos;
  modo?: ModoCifra;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const reducir = useReducirMovimiento();
  // `null` mientras no empieza a contar (se ve `desde`); cada cuadro de animación lo mueve hacia `hasta`.
  const [valor, setValor] = useState<number | null>(null);
  const cuadro = useRef<number | null>(null);
  const quieta = reducir || desde === hasta;
  useEffect(() => {
    if (quieta) return;
    // Por cuadros (≈ 60 por segundo) y no por reloj: siempre termina, aunque el reloj no avance.
    const cuadros = Math.max(1, Math.round(DURACION_CUENTA_MS / 16));
    let n = 0;
    const paso = () => {
      n += 1;
      const t = Math.min(1, n / cuadros);
      const suave = 1 - (1 - t) ** 3;
      setValor(t >= 1 ? hasta : Math.round(desde + (hasta - desde) * suave));
      if (t < 1) cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);
    return () => {
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    };
  }, [desde, hasta, quieta]);
  const mostrado = quieta ? hasta : (valor ?? desde);
  return (
    <Text {...(testID ? { testID } : {})} style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {formatearCentavos(mostrado, modo)}
    </Text>
  );
}

/**
 * La barra del día (B+, D3): llena de menta lo que queda y, al registrar un gasto, se recorta hasta `despues / antes`
 * con el pedazo que se fue en coral claro. Decorativa: la cifra va al lado. Con «Reducir movimiento», sin animar.
 */
export function BarraDelDia({
  antes,
  despues,
  lleno,
  recorte,
  riel,
  testID,
}: {
  antes: Centavos;
  despues: Centavos;
  lleno: string;
  recorte: string;
  riel: string;
  testID?: string;
}) {
  const reducir = useReducirMovimiento();
  const final = antes > 0 ? Math.max(0, Math.min(1, despues / antes)) : despues > 0 ? 1 : 0;
  const inicial = despues < antes ? 1 : antes > 0 && despues > 0 ? Math.min(1, antes / despues) : final;
  const [v] = useState(() => new Animated.Value(reducir ? final : inicial));
  useEffect(() => {
    if (reducir) {
      v.setValue(final);
      return;
    }
    const a = Animated.timing(v, {
      toValue: final,
      duration: DURACION_CUENTA_MS,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [final, reducir, v]);
  return (
    <View
      {...(testID ? { testID } : {})}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: despues < antes ? recorte : riel,
        flexDirection: 'row',
      }}
    >
      <Animated.View
        style={{
          height: 10,
          borderRadius: 5,
          backgroundColor: lleno,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
