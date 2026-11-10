import { StatusBar } from 'expo-status-bar';
import { useContext, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { LoEntendido } from '../../servicios';
import {
  coloresEscucha,
  espacio,
  formatearCentavos,
  FUENTE,
  Icono,
  OBJETIVO_TACTIL_MIN,
  useCiclo,
  useReducirMovimiento,
  useTema,
} from '../../ui';
import { OrbeVivo } from '../../ui/componentes/OrbeVivo';
import { ETIQUETA_ESCUCHANDO, PISTA_ESCUCHANDO, type BotonHablar } from '../../voz';
import { useMedidasDock } from '../navegacion/DockVoz';
import {
  BTN_CANCELAR_ESCUCHA,
  BTN_LISTO_ESCUCHA,
  ETIQUETA_TE_ESCUCHO,
  etiquetaLoEntendido,
  PISTA_CANCELAR_ESCUCHA,
  PISTA_ESCUCHA_MANTENIENDO,
  PISTA_ESCUCHA_TOCANDO,
  TEXTO_VOY_ENTENDIENDO,
  ultimoTramo,
  CHIP_ME_ALCANZA_ENTENDIDO,
} from './textos';

/** Barras de la onda de voz (D2) y su alto relativo: más altas al centro. */
const ONDA = [
  0.25, 0.45, 0.7, 0.4, 0.85, 0.55, 1, 0.65, 0.9, 0.5, 1, 0.7, 0.95, 0.45, 0.8, 0.6, 0.35, 0.75, 0.5, 0.3,
];
const ALTO_ONDA = 28;
const ORBE = 104;

/**
 * «Te escucho» (premium, 08-11): la pantalla completa en pino profundo mientras escucha. Arriba «Te escucho» y la X
 * (cancela); la frase en vivo, grande y ligera; debajo «Voy entendiendo» en una fila con lo que el nivel 0 ya sacó de
 * la frase a medias (la cuenta que todavía no termina con «…»); la onda y el orbe (GPU) siguen el volumen si el
 * reconocedor lo da y, si no, se animan solos; abajo «Listo», que termina al soltarlo (mantener) o al tocarlo.
 * Nada de esto va a logs (regla 9).
 */
export function TeEscucho({
  parcial,
  entendido,
  manteniendo,
  boton,
  alCancelar,
  suscribirVolumen,
}: {
  parcial: string;
  entendido: LoEntendido;
  /** El dedo sigue en el micrófono del dock: soltar registra y deslizar cancela. */
  manteniendo: boolean;
  boton: BotonHablar;
  alCancelar: () => void;
  suscribirVolumen: ((alNivel: (nivel: number) => void) => () => void) | null;
}) {
  const { esquema } = useTema();
  const e = coloresEscucha[esquema];
  // Sin `SafeAreaProvider` (una pantalla suelta en pruebas) cuenta como 0.
  const arriba = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const { abajo } = useMedidasDock();
  const frase = ultimoTramo(parcial);
  return (
    <View
      testID="hoja-escuchando"
      accessibilityViewIsModal
      style={{
        flex: 1,
        backgroundColor: e.fondo,
        paddingTop: arriba + espacio.m,
        paddingBottom: abajo,
        paddingHorizontal: espacio.xl,
      }}
    >
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FUENTE, fontSize: 15, lineHeight: 20, color: e.textoSecundario }}
        >
          {ETIQUETA_TE_ESCUCHO}
        </Text>
        <Pressable
          testID="boton-cancelar-escucha"
          onPress={alCancelar}
          accessibilityRole="button"
          accessibilityLabel={BTN_CANCELAR_ESCUCHA}
          accessibilityHint={PISTA_CANCELAR_ESCUCHA}
          style={({ pressed }) => ({
            width: OBJETIVO_TACTIL_MIN,
            height: OBJETIVO_TACTIL_MIN,
            borderRadius: OBJETIVO_TACTIL_MIN / 2,
            borderWidth: 1,
            borderColor: e.linea,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icono nombre="cerrar" color={e.texto} tamano={18} grosor={1.8} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingTop: espacio.l, gap: espacio.xl }}>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={parcial === '' ? ETIQUETA_ESCUCHANDO : parcial}
          style={{
            fontFamily: FUENTE,
            fontSize: 34,
            lineHeight: 42,
            fontWeight: '300',
            letterSpacing: -0.5,
            color: e.texto,
          }}
        >
          <Text testID="transcripcion-en-vivo">{frase}</Text>
          {/* La frase sigue creciendo. */}
          <Text style={{ fontFamily: FUENTE, fontWeight: '300', color: e.chipListo }}>|</Text>
        </Text>
        <LoQueVoyEntendiendo entendido={entendido} />
      </View>

      <OndaDeVoz suscribirVolumen={suscribirVolumen} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: espacio.m,
        }}
      >
        <OrbeVivo tamano={ORBE} suscribirVolumen={suscribirVolumen} testID="orbe-escucha" />
        {/* Con un toque se termina de escuchar aquí; mientras se mantiene, manda el micrófono del dock (debajo). */}
        <Pressable
          testID="boton-terminar-escucha"
          onPressIn={boton.alPresionarDentro}
          onPressOut={boton.alSoltar}
          accessibilityRole="button"
          accessibilityLabel={ETIQUETA_ESCUCHANDO}
          accessibilityHint={PISTA_ESCUCHANDO}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: 28,
            paddingHorizontal: espacio.xxl,
            backgroundColor: e.texto,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text
            importantForAccessibility="no"
            style={{ fontFamily: FUENTE, fontSize: 16, lineHeight: 22, fontWeight: '600', color: e.fondo }}
          >
            {BTN_LISTO_ESCUCHA}
          </Text>
        </Pressable>
      </View>
      <Text
        testID="pista-escucha"
        style={{
          fontFamily: FUENTE,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          paddingTop: espacio.s,
          color: e.textoSecundario,
        }}
      >
        {manteniendo ? PISTA_ESCUCHA_MANTENIENDO : PISTA_ESCUCHA_TOCANDO}
      </Text>
    </View>
  );
}

/** «Voy entendiendo»: la cifra, la categoría y la cuenta que ya salen de la frase a medias (nivel 0, sin red). */
function LoQueVoyEntendiendo({ entendido }: { entendido: LoEntendido }) {
  const { esquema } = useTema();
  const e = coloresEscucha[esquema];
  const hay = entendido.monto !== null || entendido.categoria !== null || entendido.cuenta !== null;
  const nombre: { testID: string; texto: string } | null = entendido.meAlcanza
    ? { testID: 'entendido-me-alcanza', texto: CHIP_ME_ALCANZA_ENTENDIDO }
    : entendido.categoria
      ? { testID: 'entendido-categoria', texto: entendido.categoria.nombre }
      : null;
  return (
    <View
      testID="voy-entendiendo"
      accessible={hay}
      {...(hay ? { accessibilityLabel: etiquetaLoEntendido(entendido) } : {})}
      style={{ gap: espacio.xs, minHeight: 72 }}
    >
      {hay ? (
        <>
          <Text style={{ fontFamily: FUENTE, fontSize: 14, lineHeight: 20, color: e.textoSecundario }}>
            {TEXTO_VOY_ENTENDIENDO}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: espacio.m,
              minHeight: 62,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: e.linea,
            }}
          >
            <View style={{ flexShrink: 1, gap: 2 }}>
              {nombre ? (
                <Text
                  testID={nombre.testID}
                  style={{
                    fontFamily: FUENTE,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: '500',
                    color: e.texto,
                  }}
                >
                  {nombre.texto}
                </Text>
              ) : null}
              {entendido.cuenta ? (
                <Text
                  testID="entendido-cuenta"
                  style={{
                    fontFamily: FUENTE,
                    fontSize: 14,
                    lineHeight: 20,
                    color: entendido.cuenta.seguro ? e.textoSecundario : e.filoTentativo,
                  }}
                >
                  {entendido.cuenta.seguro ? entendido.cuenta.nombre : `${entendido.cuenta.nombre} …`}
                </Text>
              ) : null}
            </View>
            {entendido.monto !== null ? (
              <Text
                testID="entendido-monto"
                style={{
                  fontFamily: FUENTE,
                  fontSize: 26,
                  lineHeight: 32,
                  fontWeight: '300',
                  color: e.texto,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatearCentavos(entendido.monto)}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * La onda de voz (D2): veinte barras menta. Si el reconocedor da el volumen, crecen con él; si no (o mientras no
 * llega), respiran solas a destiempo. Decorativa. Quieta con «Reducir movimiento».
 */
function OndaDeVoz({
  suscribirVolumen,
}: {
  suscribirVolumen: ((alNivel: (nivel: number) => void) => () => void) | null;
}) {
  const reducir = useReducirMovimiento();
  const [nivel] = useState(() => new Animated.Value(0.35));
  const [conVolumen, setConVolumen] = useState(false);
  useEffect(() => {
    if (!suscribirVolumen || reducir) return;
    let primero = true;
    return suscribirVolumen((n) => {
      if (primero) {
        primero = false;
        setConVolumen(true);
      }
      Animated.timing(nivel, { toValue: n, duration: 90, useNativeDriver: true }).start();
    });
  }, [suscribirVolumen, reducir, nivel]);
  return (
    <View
      testID="onda-voz"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: ALTO_ONDA,
      }}
    >
      {ONDA.map((alto, i) => (
        <BarraOnda key={i} alto={alto} indice={i} nivel={conVolumen ? nivel : null} />
      ))}
    </View>
  );
}

function BarraOnda({ alto, indice, nivel }: { alto: number; indice: number; nivel: Animated.Value | null }) {
  const { esquema } = useTema();
  const e = coloresEscucha[esquema];
  const ciclo = useCiclo(nivel === null, 700 + (indice % 5) * 90, (indice * 83) % 400);
  const fuente = nivel ?? ciclo;
  return (
    <Animated.View
      style={{
        width: 4,
        height: ALTO_ONDA * alto,
        borderRadius: 2,
        backgroundColor: e.chipListo,
        opacity: indice % 3 === 1 ? 0.55 : 1,
        transform: [{ scaleY: fuente.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) }],
      }}
    />
  );
}
