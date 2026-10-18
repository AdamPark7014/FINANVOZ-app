import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio, tipo } from '../tokens';

export type VarianteBoton = 'primario' | 'secundario' | 'texto';

export interface BotonProps {
  /** Verbo primero: "Guardar", "Ver qué viene" (02-UX §14). */
  etiqueta: string;
  alPresionar: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
  /** Etiqueta de TalkBack si el texto visible no basta. */
  etiquetaAccesible?: string;
  /** Qué pasa al tocarlo, leído por TalkBack después de la etiqueta. */
  pista?: string;
  ancho?: 'completo' | 'contenido';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Boton({
  etiqueta,
  alPresionar,
  variante = 'primario',
  deshabilitado = false,
  cargando = false,
  etiquetaAccesible,
  pista,
  ancho = 'completo',
  style,
  testID,
}: BotonProps) {
  const { c } = useTema();
  const inactivo = deshabilitado || cargando;
  const fondo = variante === 'primario' ? (inactivo ? c.superficieAlterna : c.acento) : 'transparent';
  const colorTexto = inactivo
    ? c.textoDeshabilitado
    : variante === 'primario'
      ? c.sobreAcento
      : c.acentoTexto;
  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiquetaHablada(etiqueta)}
      accessibilityHint={pista}
      accessibilityState={{ disabled: deshabilitado, busy: cargando }}
      hitSlop={variante === 'texto' ? espacio.s : undefined}
      style={({ pressed }) => [
        {
          minHeight: OBJETIVO_TACTIL_MIN,
          minWidth: OBJETIVO_TACTIL_MIN,
          paddingHorizontal: variante === 'texto' ? espacio.s : espacio.xl,
          paddingVertical: espacio.m,
          borderRadius: radio.m,
          backgroundColor: fondo,
          borderWidth: variante === 'secundario' ? 1.5 : 0,
          borderColor: inactivo ? c.borde : c.acentoTexto,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: ancho === 'completo' ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        {cargando ? <ActivityIndicator color={colorTexto} /> : null}
        <Text style={[tipo.etiqueta, { fontSize: 16, color: colorTexto, textAlign: 'center' }]}>
          {etiqueta}
        </Text>
      </View>
    </Pressable>
  );
}
