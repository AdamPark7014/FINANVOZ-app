import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, View } from 'react-native';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import {
  Barra,
  Pantalla,
  Texto,
  espacio,
  etiquetaHablada,
  OBJETIVO_TACTIL_MIN,
  radio,
  useTema,
} from '../../ui';
import {
  anuncioCambioPasoOnboarding,
  etiquetaAyudaPasoOnboarding,
  etiquetaProgresoOnboarding,
  etiquetaTipOnboarding,
  etiquetaTituloPasoOnboarding,
  numeroPasoOnboarding,
  pasosVisiblesOnboarding,
  PISTA_CASILLA_ONB,
  PISTA_CHIP_ONB_ELEGIR,
  PISTA_CHIP_ONB_SELECCIONADA,
  PISTA_PROGRESO_ONB,
  progresoOnboardingBp,
  textoProgresoOnboarding,
} from './textos';

export { ERROR_GUARDAR, PASOS_ONBOARDING } from './textos';

/** En iPhone no hay captura de notificaciones: O6 se omite (`02 §25`) y el onboarding tiene un paso menos. */
export const OMITIR_CAPTURA_ONB = Platform.OS === 'ios';
/** «Paso n de 6» en iPhone, «de 7» en Android. */
export const PASOS_VISIBLES_ONB = pasosVisiblesOnboarding(OMITIR_CAPTURA_ONB);
/** Número visible de O1–O7 en este teléfono (en iPhone el colchón es el paso 6). */
export const pasoVisibleOnb = (o: 1 | 2 | 3 | 4 | 5 | 6 | 7) => numeroPasoOnboarding(o, OMITIR_CAPTURA_ONB);

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
  enfocar = false,
  testID,
}: {
  etiqueta?: string;
  opciones: readonly OpcionChip<T>[];
  valor: T | null;
  alCambiar: (valor: T) => void;
  /** Lleva el foco del lector a este grupo (el primer dato que falta después de «Dímelo»). */
  enfocar?: boolean;
  /** Prefijo: cada chip queda como `<testID>-<valor>`. */
  testID: string;
}) {
  const { c } = useTema();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!enfocar) return;
    const nodo = findNodeHandle(ref.current);
    if (nodo != null) AccessibilityInfo.setAccessibilityFocus(nodo);
  }, [enfocar]);
  return (
    <View
      ref={ref}
      style={{ gap: espacio.xs }}
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta}
      testID={`${testID}-grupo`}
    >
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
                paddingVertical: espacio.s,
                borderRadius: radio.pastilla,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? c.acentoTexto : c.borde,
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
      style={({ pressed }) => ({
        minHeight: OBJETIVO_TACTIL_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingVertical: espacio.xs,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radio.m,
          borderWidth: valor ? 0 : 2,
          borderColor: c.borde,
          backgroundColor: valor ? c.acento : c.superficieAlterna,
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

/** Marco de cada paso: «Paso n de 7» (de 6 en iPhone) con su barra, título, ayuda y botones fijos al pie. */
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
  const { c } = useTema();
  return (
    <Pantalla
      testID={testID}
      bordes={['top', 'left', 'right', 'bottom']}
      pie={pie}
      contenidoStyle={{ gap: espacio.xl }}
    >
      <View style={{ gap: espacio.s }}>
        <Texto
          variante="pequeno"
          tono="acento"
          testID="onb-progreso"
          accessibilityRole="text"
          accessibilityLabel={etiquetaProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
          accessibilityHint={PISTA_PROGRESO_ONB}
        >
          {textoProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
        </Texto>
        {/* La barra repite lo que dice el texto de arriba: el lector no la lee dos veces. */}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Barra
            testID="onb-progreso-barra"
            llenoBp={progresoOnboardingBp(paso, PASOS_VISIBLES_ONB)}
            etiquetaAccesible={etiquetaProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
            alto={8}
          />
        </View>
      </View>
      <View
        ref={refTitulo}
        testID="onb-titulo-paso"
        accessible
        accessibilityRole="header"
        accessibilityLabel={etiquetaTituloPasoOnboarding(titulo)}
        style={{ marginTop: espacio.s }}
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
        <View
          testID="onb-tip"
          accessible
          accessibilityRole="text"
          accessibilityLabel={etiquetaTipOnboarding(tip)}
          style={{
            padding: espacio.l,
            borderRadius: radio.l,
            backgroundColor: c.superficieAlterna,
          }}
        >
          <Texto variante="secundario" tono="secundario" accessible={false}>
            {tip}
          </Texto>
        </View>
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
