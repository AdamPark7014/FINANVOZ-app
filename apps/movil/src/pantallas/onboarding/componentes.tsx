import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, View } from 'react-native';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { Pantalla, Texto, espacio, etiquetaHablada, OBJETIVO_TACTIL_MIN, radio, useTema } from '../../ui';
import {
  anuncioCambioPasoOnboarding,
  etiquetaAyudaPasoOnboarding,
  etiquetaProgresoOnboarding,
  PASOS_ONBOARDING,
  etiquetaTipOnboarding,
  etiquetaTituloPasoOnboarding,
  PISTA_CASILLA_ONB,
  PISTA_CHIP_ONB_ELEGIR,
  PISTA_CHIP_ONB_SELECCIONADA,
  PISTA_PROGRESO_ONB,
  textoProgresoOnboarding,
} from './textos';

export { ERROR_GUARDAR, PASOS_ONBOARDING } from './textos';

/** En iPhone no hay captura de notificaciones: O6 se omite (`02 §25`) y el onboarding tiene un paso menos. */
export const OMITIR_CAPTURA_ONB = Platform.OS === 'ios';
export const PASOS_VISIBLES_ONB = OMITIR_CAPTURA_ONB ? PASOS_ONBOARDING - 1 : PASOS_ONBOARDING;

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
              accessibilityHint={activo ? PISTA_CHIP_ONB_SELECCIONADA : PISTA_CHIP_ONB_ELEGIR}
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
      accessibilityHint={PISTA_CASILLA_ONB}
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
  const refTitulo = useRef<View>(null);
  useEffect(() => {
    registrarEvento({ nombre: 'onboarding_paso', propiedades: { paso } });
  }, [registrarEvento, paso]);
  useEffect(() => {
    let vigente = true;
    const anuncio = anuncioCambioPasoOnboarding(paso, titulo, PASOS_VISIBLES_ONB);
    AccessibilityInfo.isScreenReaderEnabled()
      .then((lector) => {
        if (!vigente || lector !== true) return;
        AccessibilityInfo.announceForAccessibility(anuncio);
        const nodo = findNodeHandle(refTitulo.current);
        if (nodo != null) {
          requestAnimationFrame(() => {
            if (vigente) AccessibilityInfo.setAccessibilityFocus(nodo);
          });
        }
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [paso, titulo]);
  return (
    <Pantalla testID={testID} bordes={['top', 'left', 'right', 'bottom']} pie={pie}>
      <Texto
        variante="secundario"
        tono="secundario"
        testID="onb-progreso"
        accessibilityRole="text"
        accessibilityLabel={etiquetaProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
        accessibilityHint={PISTA_PROGRESO_ONB}
      >
        {textoProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
      </Texto>
      <View
        ref={refTitulo}
        testID="onb-titulo-paso"
        accessible
        accessibilityRole="header"
        accessibilityLabel={etiquetaTituloPasoOnboarding(titulo)}
      >
        <Texto variante="titulo" accessible={false}>
          {titulo}
        </Texto>
      </View>
      {ayuda ? (
        <Texto
          variante="cuerpo"
          tono="secundario"
          accessibilityRole="text"
          accessibilityLabel={etiquetaAyudaPasoOnboarding(ayuda)}
        >
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
