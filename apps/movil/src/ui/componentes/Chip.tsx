import { Pressable, View } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, hitSlopTactil, OBJETIVO_TACTIL_MIN, radio } from '../tokens';
import { Texto } from './Texto';

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
  deshabilitado = false,
  etiquetaAccesible,
  pista,
  testID,
}: {
  etiqueta: string;
  seleccionado: boolean;
  alPresionar: () => void;
  /** Se pueden elegir varias del grupo ("¿Con quién?"). */
  multiple?: boolean;
  deshabilitado?: boolean;
  /** TalkBack si el texto visible no basta (p. ej. «Caro ×2»). */
  etiquetaAccesible?: string;
  /** Qué pasa al tocarlo, leído por TalkBack después de la etiqueta. */
  pista?: string;
  testID?: string;
}) {
  const { c } = useTema();
  const pistaPorOmision = deshabilitado
    ? 'No disponible'
    : multiple
      ? 'Marca o desmarca esta opción'
      : 'Selecciona esta opción';
  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      disabled={deshabilitado}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={etiquetaChipHablada(etiqueta, etiquetaAccesible)}
      accessibilityHint={pista ?? pistaPorOmision}
      accessibilityState={
        multiple
          ? { checked: seleccionado, disabled: deshabilitado }
          : { selected: seleccionado, disabled: deshabilitado }
      }
      hitSlop={hitSlopTactil}
      style={({ pressed }) => ({
        minHeight: OBJETIVO_TACTIL_MIN,
        minWidth: OBJETIVO_TACTIL_MIN,
        paddingHorizontal: espacio.l,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radio.pastilla,
        // Dirección B (tablero B4): el elegido va lleno de pino y en negritas; los demás, en blanco con filo. Cambia el
        // relleno y el peso de la letra, no solo el color (`02 §15`).
        borderWidth: 1,
        borderColor: deshabilitado ? c.bordeControl : seleccionado ? c.acento : c.borde,
        opacity: deshabilitado ? 0.55 : pressed ? 0.9 : 1,
        backgroundColor: seleccionado ? c.acento : pressed ? c.superficieAlterna : c.superficie,
        transform: [{ scale: pressed && !deshabilitado ? 0.97 : 1 }],
        paddingVertical: espacio.s,
      })}
    >
      <Texto
        variante="etiqueta"
        tono={deshabilitado ? 'secundario' : 'normal'}
        style={{
          fontSize: 15,
          fontWeight: seleccionado ? '700' : '600',
          ...(seleccionado ? { color: c.sobreAcento } : null),
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {etiqueta}
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
  const seleccionada = valor !== null ? opciones.find((o) => o.valor === valor) : undefined;
  const pistaGrupo =
    seleccionada !== undefined
      ? `Seleccionado: ${etiquetaChipHablada(seleccionada.etiqueta, seleccionada.etiquetaAccesible)}`
      : etiqueta !== undefined
        ? 'Elige una opción'
        : undefined;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta ? etiquetaHablada(etiqueta) : undefined}
      {...(pistaGrupo === undefined ? {} : { accessibilityHint: pistaGrupo })}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, alignItems: 'center' }}
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
