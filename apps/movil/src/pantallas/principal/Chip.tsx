import { Pressable, View } from 'react-native';
import { espacio, etiquetaHablada, OBJETIVO_TACTIL_MIN, radio, Texto, useTema } from '../../ui';

export interface OpcionChip<T extends string> {
  readonly valor: T;
  readonly etiqueta: string;
  /** TalkBack si el texto visible no basta (p. ej. montos o «Caro ×2»). */
  readonly etiquetaAccesible?: string;
}

function etiquetaChipHablada(etiqueta: string, etiquetaAccesible?: string): string {
  if (etiquetaAccesible) return etiquetaHablada(etiquetaAccesible);
  const veces = /^(.+) ×(\d+)$/.exec(etiqueta);
  if (veces) {
    const [, nombre, n] = veces;
    return etiquetaHablada(`${nombre}, ${n} veces`);
  }
  return etiquetaHablada(etiqueta);
}

/** Pregunta visible arriba del grupo; TalkBack usa `etiqueta` en `GrupoChips`. */
export const OCULTAR_ETIQUETA_VISIBLE = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/**
 * Opción tocable de una pregunta (02-UX §1.2: una pregunta a la vez, con opciones tocables). Por omisión es de
 * selección única (TalkBack: `accessibilityLabel` propia; el texto visible no se anuncia aparte); con `multiple`, casilla.
 */
export function Chip({
  etiqueta,
  seleccionado,
  alPresionar,
  multiple = false,
  etiquetaAccesible,
  testID,
}: {
  etiqueta: string;
  seleccionado: boolean;
  alPresionar: () => void;
  /** Se pueden elegir varias del grupo ("¿Con quién?"). */
  multiple?: boolean;
  /** TalkBack si el texto visible no basta (p. ej. «Caro ×2»). */
  etiquetaAccesible?: string;
  testID?: string;
}) {
  const { c } = useTema();
  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={etiquetaChipHablada(etiqueta, etiquetaAccesible)}
      accessibilityState={multiple ? { checked: seleccionado } : { selected: seleccionado }}
      style={({ pressed }) => ({
        minHeight: OBJETIVO_TACTIL_MIN,
        paddingHorizontal: espacio.l,
        justifyContent: 'center',
        borderRadius: radio.pastilla,
        borderWidth: seleccionado ? 2 : 1,
        borderColor: seleccionado ? c.acentoTexto : c.bordeControl,
        backgroundColor: seleccionado ? c.superficieAlterna : pressed ? c.superficieAlterna : c.superficie,
      })}
    >
      <Texto
        variante="etiqueta"
        tono={seleccionado ? 'acento' : 'normal'}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {seleccionado ? `✓ ${etiqueta}` : etiqueta}
      </Texto>
    </Pressable>
  );
}

/** Fila de chips con selección única. */
export function GrupoChips<T extends string>({
  opciones,
  valor,
  alCambiar,
  prefijoTestID,
  etiqueta,
}: {
  opciones: readonly OpcionChip<T>[];
  valor: T | null;
  alCambiar: (v: T) => void;
  prefijoTestID?: string;
  /** Pregunta del grupo (TalkBack en el radiogroup), p. ej. «¿Con qué pagaste?». */
  etiqueta?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta ? etiquetaHablada(etiqueta) : undefined}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}
    >
      {opciones.map((o) => (
        <Chip
          key={o.valor}
          etiqueta={o.etiqueta}
          seleccionado={valor === o.valor}
          alPresionar={() => alCambiar(o.valor)}
          {...(o.etiquetaAccesible ? { etiquetaAccesible: o.etiquetaAccesible } : {})}
          {...(prefijoTestID ? { testID: `${prefijoTestID}-${o.valor}` } : {})}
        />
      ))}
    </View>
  );
}
