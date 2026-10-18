import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { Pantalla, Texto, espacio, etiquetaHablada, OBJETIVO_TACTIL_MIN, radio, useTema } from '../../ui';
import { etiquetaProgresoOnboarding, etiquetaTipOnboarding, textoProgresoOnboarding } from './textos';

export { ERROR_GUARDAR, PASOS_ONBOARDING } from './textos';

export interface OpcionChip<T> {
  valor: T;
  etiqueta: string;
}

/**
 * Chips de una sola opción (`02 §1`: opciones tocables, la más probable primero). Cada chip se anuncia como
 * opción con su estado; el seleccionado no depende solo del color (lleva borde grueso y "✓").
 */
export function Chips<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  testID,
}: {
  etiqueta?: string;
  opciones: readonly OpcionChip<T>[];
  valor: T | null;
  alCambiar: (valor: T) => void;
  /** Prefijo: cada chip queda como `<testID>-<valor>`. */
  testID: string;
}) {
  const { c } = useTema();
  return (
    <View style={{ gap: espacio.xs }} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
      {etiqueta ? <Texto variante="etiqueta">{etiqueta}</Texto> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={String(o.valor)}
              testID={`${testID}-${o.valor}`}
              onPress={() => alCambiar(o.valor)}
              accessibilityRole="radio"
              accessibilityLabel={etiquetaHablada(o.etiqueta)}
              accessibilityState={{ selected: activo, checked: activo }}
              style={{
                minHeight: OBJETIVO_TACTIL_MIN,
                justifyContent: 'center',
                paddingHorizontal: espacio.l,
                borderRadius: radio.pastilla,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? c.acentoTexto : c.bordeControl,
                backgroundColor: activo ? c.superficieAlterna : c.superficie,
              }}
            >
              <Texto variante="etiqueta" tono={activo ? 'acento' : 'normal'}>
                {activo ? `✓ ${o.etiqueta}` : o.etiqueta}
              </Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Casilla de verificación (consentimiento, `08 §2`: nunca viene marcada). */
export function Casilla({
  etiqueta,
  valor,
  alCambiar,
  testID,
}: {
  etiqueta: string;
  valor: boolean;
  alCambiar: (valor: boolean) => void;
  testID: string;
}) {
  const { c } = useTema();
  return (
    <Pressable
      testID={testID}
      onPress={() => alCambiar(!valor)}
      accessibilityRole="checkbox"
      accessibilityLabel={etiquetaHablada(etiqueta)}
      accessibilityState={{ checked: valor }}
      style={{ minHeight: OBJETIVO_TACTIL_MIN, flexDirection: 'row', alignItems: 'center', gap: espacio.m }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radio.s,
          borderWidth: 2,
          borderColor: valor ? c.acento : c.textoSecundario,
          backgroundColor: valor ? c.acento : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {valor ? (
          <Texto variante="etiqueta" style={{ color: c.sobreAcento }}>
            ✓
          </Texto>
        ) : null}
      </View>
      <Texto variante="cuerpo" style={{ flex: 1 }}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

/** Marco de cada paso: "Paso n de 7", título, ayuda y botones fijos al pie. */
export function PasoOnboarding({
  paso,
  titulo,
  ayuda,
  tip,
  pie,
  children,
  testID,
}: {
  paso: number;
  titulo: string;
  ayuda?: string;
  /** Consejo corto opcional (`02 §14`, tuteo). */
  tip?: string;
  pie?: ReactNode;
  children?: ReactNode;
  testID: string;
}) {
  // Antes de O2 no hay consentimiento y la analítica no envía nada.
  const registrarEvento = useAnalitica();
  useEffect(() => {
    registrarEvento({ nombre: 'onboarding_paso', propiedades: { paso } });
  }, [registrarEvento, paso]);
  return (
    <Pantalla testID={testID} bordes={['top', 'left', 'right', 'bottom']} pie={pie}>
      <Texto
        variante="secundario"
        tono="secundario"
        testID="onb-progreso"
        accessibilityRole="text"
        accessibilityLabel={etiquetaProgresoOnboarding(paso)}
      >
        {textoProgresoOnboarding(paso)}
      </Texto>
      <Texto variante="titulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {ayuda ? (
        <Texto variante="cuerpo" tono="secundario">
          {ayuda}
        </Texto>
      ) : null}
      {tip ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID="onb-tip"
          accessibilityRole="text"
          accessibilityLabel={etiquetaTipOnboarding(tip)}
        >
          {tip}
        </Texto>
      ) : null}
      {children}
    </Pantalla>
  );
}

/** Mensaje de error de formulario (`02 §14`: qué pasó + qué hacer). Nunca muestra el detalle técnico. */
export function MensajeError({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <Texto
      variante="secundario"
      tono="faltante"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      importantForAccessibility="yes"
      accessibilityLabel={texto}
      testID="error-formulario"
    >
      {texto}
    </Texto>
  );
}

