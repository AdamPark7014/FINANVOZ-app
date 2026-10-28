import { Text, View } from 'react-native';
import type { EnQueSeFue as DatosEnQueSeFue } from '../../servicios';
import {
  BarraApilada,
  cifraEnPalabras,
  coloresCategoria,
  espacio,
  etiquetaHablada,
  familiaDeCategoria,
  formatearCentavos,
  FUENTE,
  useTema,
} from '../../ui';
import { TITULO_EN_QUE_SE_FUE } from './textos';

/**
 * «En qué se fue» (dirección B+, D5): lo que salió en el mes por categoría, como barra apilada con el color de cada
 * una y su leyenda en dos columnas (nombre y cifra; el color nunca va solo). Los datos vienen de `enQueSeFue` y
 * suman lo mismo que «En octubre salieron…» (regla 4); aquí solo se acomodan.
 */
export function EnQueSeFue({ datos }: { datos: DatosEnQueSeFue }) {
  const { c, esquema } = useTema();
  const color = (slug: string | null) =>
    slug === null
      ? coloresCategoria[esquema].otros.barra
      : coloresCategoria[esquema][familiaDeCategoria(slug)].barra;
  return (
    <View
      testID="en-que-se-fue"
      style={{
        backgroundColor: c.superficie,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borde,
        paddingHorizontal: espacio.l,
        paddingVertical: espacio.m,
        gap: espacio.m,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: FUENTE,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: '600',
          color: c.textoSecundario,
        }}
      >
        {TITULO_EN_QUE_SE_FUE}
      </Text>
      <BarraApilada
        testID="en-que-se-fue-barra"
        partes={datos.categorias.map((g) => ({
          clave: g.slug ?? 'otros',
          valor: g.monto,
          color: color(g.slug),
        }))}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: espacio.s, columnGap: espacio.l }}>
        {datos.categorias.map((g) => (
          <View
            key={g.slug ?? 'otros'}
            accessible
            accessibilityLabel={`${etiquetaHablada(g.nombre)}: ${cifraEnPalabras(g.monto, 'pesos')}`}
            testID={`en-que-se-fue-${g.slug ?? 'otros'}`}
            style={{ flexBasis: '45%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color(g.slug) }} />
            <Text style={{ fontFamily: FUENTE, flex: 1, fontSize: 15, lineHeight: 20, color: c.texto }}>
              {g.nombre}
            </Text>
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 15,
                lineHeight: 20,
                fontWeight: '800',
                color: c.texto,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatearCentavos(g.monto, 'pesos')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
