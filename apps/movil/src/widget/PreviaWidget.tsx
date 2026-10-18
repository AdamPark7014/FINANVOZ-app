import { StyleSheet, Text, View } from 'react-native';
import { construirVistaWidget, type VistaWidget } from '../servicios';
import { colores, NUMEROS_TABULARES, type EsquemaColor } from '../ui/tokens';
import { detalleConSeparador, etiquetaAccesibleWidget, tamanoFuenteCifra } from './formatoWidget';

/** Ejemplo fijo para Ajustes y documentación (misma línea que la semilla e4-01). */
export const VISTA_EJEMPLO_WIDGET = construirVistaWidget(
  { estado: 'normal', hoyPuedesPesos: 214, dias: 4 },
  { ocultarMontos: false },
);

/**
 * Vista previa en la app (Ajustes → Widget): imita el widget del lanzador con componentes RN,
 * no el árbol `react-native-android-widget`.
 */
export function PreviaWidget({
  vista,
  esquema,
  pistaAccesible,
}: {
  vista: VistaWidget;
  esquema: EsquemaColor;
  /** Hint TalkBack (p. ej. que la vista previa usa cifras fijas). */
  pistaAccesible?: string;
}) {
  const c = colores[esquema];
  const conCifra = vista.cifra !== null && vista.titulo !== null && vista.detalle !== null;
  const tamCifra = vista.cifra ? tamanoFuenteCifra(vista.cifra) : 22;
  return (
    <View
      testID="previa-widget"
      accessibilityRole="summary"
      accessibilityLabel={etiquetaAccesibleWidget(vista)}
      {...(pistaAccesible ? { accessibilityHint: pistaAccesible } : {})}
      style={[estilos.contenedor, { backgroundColor: c.superficie, borderColor: c.borde }]}
    >
      {conCifra ? (
        <View
          testID="previa-widget-fila"
          style={estilos.fila}
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            testID="previa-widget-titulo"
            importantForAccessibility="no"
            style={[estilos.titulo, { color: c.texto }]}
          >
            {vista.titulo}
          </Text>
          <Text
            testID="previa-widget-cifra"
            importantForAccessibility="no"
            style={[
              estilos.cifra,
              {
                color: c.acentoTexto,
                fontSize: tamCifra,
                lineHeight: tamCifra + 4,
                fontVariant: [...NUMEROS_TABULARES],
              },
            ]}
          >
            {vista.cifra}
          </Text>
          <Text
            testID="previa-widget-detalle"
            importantForAccessibility="no"
            style={[estilos.detalle, { color: c.textoSecundario }]}
          >
            {detalleConSeparador(vista.detalle)}
          </Text>
        </View>
      ) : (
        <View testID="previa-widget-solo-texto" importantForAccessibility="no-hide-descendants">
          <Text importantForAccessibility="no" style={[estilos.titulo, { color: c.texto }]} numberOfLines={2}>
            {vista.texto}
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 2,
  },
  titulo: { fontSize: 16 },
  cifra: { fontWeight: '700' },
  detalle: { fontSize: 16 },
});
