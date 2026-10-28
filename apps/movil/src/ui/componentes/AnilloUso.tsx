import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { FUENTE } from '../tokens';

/**
 * El anillo de uso del crédito (dirección B+, D6): el riel claro y lo usado del límite en violeta, empezando arriba,
 * con el porcentaje al centro. Decorativo: quien lo usa dice el uso en su etiqueta.
 */
export function AnilloUso({
  fraccion,
  texto,
  color,
  riel,
  tinta,
  tamano = 52,
  testID,
}: {
  /** De 0 a 1 (se recorta a ese rango). */
  fraccion: number;
  /** «12 %». */
  texto: string;
  color: string;
  riel: string;
  /** Color del texto del centro. */
  tinta: string;
  tamano?: number;
  testID?: string;
}) {
  const grosor = 5;
  const r = (tamano - grosor) / 2;
  const vuelta = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(1, fraccion)) * vuelta;
  return (
    <View
      {...(testID ? { testID } : {})}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={tamano} height={tamano} style={{ position: 'absolute' }}>
        <Circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={riel} strokeWidth={grosor} />
        {lleno > 0 ? (
          <Circle
            cx={tamano / 2}
            cy={tamano / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={`${lleno} ${vuelta}`}
            transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={{ fontFamily: FUENTE, fontSize: 13, lineHeight: 16, fontWeight: '800', color: tinta }}>
        {texto}
      </Text>
    </View>
  );
}
