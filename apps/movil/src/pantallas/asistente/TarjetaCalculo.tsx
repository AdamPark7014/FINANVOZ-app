import { Text, View } from 'react-native';
import { FUENTE, cifraEnPalabras, espacio, etiquetaHablada, useTema } from '../../ui';
import { BTN_COMO_LO_CALCULE } from './textos';

export interface FilaCalculo {
  /** «Tienes en efectivo y BBVA». */
  readonly etiqueta: string;
  /** Lo que se ve a la derecha: «$5,224», «−$2,849», «$143 al día». */
  readonly valor: string;
  /** Para el lector: la fila completa con las cifras en palabras. */
  readonly centavos: number;
  readonly fuerte?: boolean;
  readonly testID?: string;
}

/**
 * «Cómo lo calculé» de la dirección B (tablero B3): una tarjeta gris verdosa con lo que tienes, lo reservado, el
 * colchón y lo libre entre los días que faltan. Solo presenta cifras que ya calculó `servicios/` (regla 4). Cada fila
 * es un solo elemento para el lector («Colchón: menos mil trescientos pesos»).
 */
export function TarjetaCalculo({
  filas,
  testID,
  titulo = BTN_COMO_LO_CALCULE,
}: {
  filas: readonly FilaCalculo[];
  testID?: string;
  titulo?: string;
}) {
  const { c } = useTema();
  return (
    <View
      {...(testID ? { testID } : {})}
      style={{
        backgroundColor: c.superficieAlterna,
        borderRadius: 22,
        paddingVertical: 14,
        paddingHorizontal: 18,
        gap: espacio.xs + 2,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: FUENTE,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '700',
          color: c.textoSecundario,
        }}
      >
        {titulo}
      </Text>
      {filas.map((f) => (
        <View
          key={f.etiqueta}
          accessible
          accessibilityLabel={`${etiquetaHablada(f.etiqueta)}: ${cifraEnPalabras(f.centavos)}${f.valor.endsWith('al día') ? ' al día' : ''}`}
          {...(f.testID ? { testID: f.testID } : {})}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            columnGap: espacio.s,
          }}
        >
          <Text
            style={{
              fontFamily: FUENTE,
              flexShrink: 1,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: f.fuerte ? '700' : '400',
              color: c.texto,
            }}
          >
            {f.etiqueta}
          </Text>
          <Text
            {...(f.testID ? { testID: `${f.testID}-valor` } : {})}
            style={{
              fontFamily: FUENTE,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: f.fuerte ? '700' : '400',
              color: c.texto,
              fontVariant: ['tabular-nums'],
            }}
          >
            {f.valor}
          </Text>
        </View>
      ))}
    </View>
  );
}
