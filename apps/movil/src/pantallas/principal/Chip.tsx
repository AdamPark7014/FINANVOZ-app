import { Pressable, Text, View } from 'react-native';
import { espacio, etiquetaHablada, OBJETIVO_TACTIL_MIN, radio, tipo, useTema } from '../../ui';

export interface OpcionChip<T extends string> {
  readonly valor: T;
  readonly etiqueta: string;
}

/** Opción tocable de una pregunta (02-UX §1.2: una pregunta a la vez, con opciones tocables). */
export function Chip({
  etiqueta,
  seleccionado,
  alPresionar,
  testID,
}: {
  etiqueta: string;
  seleccionado: boolean;
  alPresionar: () => void;
  testID?: string;
}) {
  const { c } = useTema();
  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      accessibilityRole="radio"
      accessibilityLabel={etiquetaHablada(etiqueta)}
      accessibilityState={{ selected: seleccionado, checked: seleccionado }}
      style={({ pressed }) => ({
        minHeight: OBJETIVO_TACTIL_MIN,
        paddingHorizontal: espacio.l,
        justifyContent: 'center',
        borderRadius: radio.pastilla,
        borderWidth: seleccionado ? 2 : 1,
        borderColor: seleccionado ? c.acentoTexto : c.borde,
        backgroundColor: seleccionado ? c.superficieAlterna : pressed ? c.superficieAlterna : c.superficie,
      })}
    >
      <Text style={[tipo.etiqueta, { color: seleccionado ? c.acentoTexto : c.texto }]}>
        {seleccionado ? `✓ ${etiqueta}` : etiqueta}
      </Text>
    </Pressable>
  );
}

/** Fila de chips con selección única. */
export function GrupoChips<T extends string>({
  opciones,
  valor,
  alCambiar,
  prefijoTestID,
}: {
  opciones: readonly OpcionChip<T>[];
  valor: T | null;
  alCambiar: (v: T) => void;
  prefijoTestID?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
      {opciones.map((o) => (
        <Chip
          key={o.valor}
          etiqueta={o.etiqueta}
          seleccionado={valor === o.valor}
          alPresionar={() => alCambiar(o.valor)}
          {...(prefijoTestID ? { testID: `${prefijoTestID}-${o.valor}` } : {})}
        />
      ))}
    </View>
  );
}
