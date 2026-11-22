import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import {
  Barra,
  FUENTE,
  Icono,
  Pantalla,
  Texto,
  espacio,
  etiquetaHablada,
  OBJETIVO_TACTIL_MIN,
  radio,
  useReducirMovimiento,
  useTema,
  vibrar,
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
              onPress={() => {
                if (!activo) vibrar('seleccion');
                alCambiar(o.valor);
              }}
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
                backgroundColor: activo ? c.iconoFondo : c.superficie,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2 }}>
                {activo ? <Icono nombre="palomita" color={c.acentoTexto} tamano={16} grosor={2.4} /> : null}
                <Texto variante="etiqueta" tono={activo ? 'acento' : 'normal'}>
                  {o.etiqueta}
                </Texto>
              </View>
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
      onPress={() => {
        vibrar('seleccion');
        alCambiar(!valor);
      }}
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
        {valor ? <Icono nombre="palomita" color={c.sobreAcento} tamano={18} grosor={2.6} /> : null}
      </View>
      <Texto variante="cuerpo" style={{ flex: 1 }}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

/** Lo que tarda en entrar el contenido de un paso y lo que se desplaza (pt). */
const ENTRADA_MS = 260;
const ENTRADA_PT = 12;

/**
 * Marco de cada paso: «Paso n de 7» (de 6 en iPhone) con su barra, que avanza desde el paso anterior; el título con
 * presencia, la ayuda y los botones fijos al pie. El contenido entra con un desvanecido corto (quieto con «Reducir
 * movimiento»). El consejo va al final y sin caja: acompaña, no estorba lo que hay que contestar.
 */
export function PasoOnboarding({
  paso,
  titulo,
  ayuda,
  tip,
  pie,
  encabezado,
  children,
  testID,
}: {
  paso: number;
  titulo: string;
  ayuda?: string;
  /** Consejo corto opcional (`02 §14`, tuteo). */
  tip?: string;
  pie?: ReactNode;
  /** Algo arriba del título (el orbe de la bienvenida). Decorativo. */
  encabezado?: ReactNode;
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
  const reducir = useReducirMovimiento();
  const [entrada] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducir) {
      entrada.setValue(1);
      return;
    }
    const animacion = Animated.timing(entrada, {
      toValue: 1,
      duration: ENTRADA_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [entrada, reducir]);
  return (
    <Pantalla
      testID={testID}
      bordes={['top', 'left', 'right', 'bottom']}
      pie={pie}
      contenidoStyle={{ gap: espacio.xl, paddingBottom: espacio.xxl }}
    >
      <View style={{ gap: espacio.s }}>
        <Texto
          variante="pequeno"
          tono="acento"
          testID="onb-progreso"
          accessibilityRole="text"
          accessibilityLabel={etiquetaProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
          accessibilityHint={PISTA_PROGRESO_ONB}
          style={{ fontWeight: '600', letterSpacing: 0.2 }}
        >
          {textoProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
        </Texto>
        {/* La barra repite lo que dice el texto de arriba: el lector no la lee dos veces. */}
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Barra
            testID="onb-progreso-barra"
            llenoBp={progresoOnboardingBp(paso, PASOS_VISIBLES_ONB)}
            desdeBp={progresoOnboardingBp(paso - 1, PASOS_VISIBLES_ONB)}
            etiquetaAccesible={etiquetaProgresoOnboarding(paso, PASOS_VISIBLES_ONB)}
            alto={6}
          />
        </View>
      </View>
      <Animated.View
        style={{
          gap: espacio.xl,
          opacity: entrada,
          transform: [
            { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [ENTRADA_PT, 0] }) },
          ],
        }}
      >
        {encabezado}
        <View style={{ gap: espacio.m }}>
          <View
            ref={refTitulo}
            testID="onb-titulo-paso"
            accessible
            accessibilityRole="header"
            accessibilityLabel={etiquetaTituloPasoOnboarding(titulo)}
            style={{ marginTop: encabezado ? 0 : espacio.s }}
          >
            <Text
              accessible={false}
              style={{
                fontFamily: FUENTE,
                fontSize: 30,
                lineHeight: 36,
                fontWeight: '700',
                letterSpacing: -0.6,
                color: c.texto,
              }}
            >
              {titulo}
            </Text>
          </View>
          {ayuda ? (
            <Texto
              variante="cuerpo"
              tono="secundario"
              accessibilityRole="text"
              accessibilityLabel={etiquetaAyudaPasoOnboarding(ayuda)}
              style={{ fontSize: 17 }}
            >
              {ayuda}
            </Texto>
          ) : null}
        </View>
        {children}
        {tip ? (
          <View
            testID="onb-tip"
            accessible
            accessibilityRole="text"
            accessibilityLabel={etiquetaTipOnboarding(tip)}
            style={{ flexDirection: 'row', gap: espacio.m, alignItems: 'flex-start' }}
          >
            <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: c.borde }} />
            <Texto variante="secundario" tono="secundario" accessible={false} style={{ flex: 1 }}>
              {tip}
            </Texto>
          </View>
        ) : null}
      </Animated.View>
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
