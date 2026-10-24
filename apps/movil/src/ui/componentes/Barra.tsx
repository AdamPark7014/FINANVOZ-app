import { View } from 'react-native';
import { useTema } from '../tema';
import { radio } from '../tokens';

export interface BarraProps {
  /** Lo lleno, en puntos base (0–10 000); lo que pase de 10 000 se dibuja lleno. */
  llenoBp: number;
  /** Marca vertical opcional (p. ej. el 30 % de uso recomendado), en puntos base. */
  marcaBp?: number;
  /** Lo que dice TalkBack: la barra nunca es la única forma de leer el dato (`02 §15`). */
  etiquetaAccesible: string;
  alto?: number;
  testID?: string;
}

const acotar = (bp: number) => Math.max(0, Math.min(10000, bp)) / 100;

/** Barra horizontal sobria (`02 §16`: las barras viven en Tarjetas y Cuentas). Solo dibuja lo que recibe. */
export function Barra({ llenoBp, marcaBp, etiquetaAccesible, alto = 12, testID }: BarraProps) {
  const { c } = useTema();
  const porcentaje = Math.round(acotar(llenoBp));
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
        backgroundColor: c.superficieAlterna,
        borderWidth: 0,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${acotar(llenoBp)}%`,
          height: '100%',
          backgroundColor: c.acento,
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
            backgroundColor: c.texto,
          }}
        />
      ) : null}
    </View>
  );
}
