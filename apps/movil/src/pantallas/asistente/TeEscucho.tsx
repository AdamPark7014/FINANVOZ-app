import { StatusBar } from 'expo-status-bar';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { LoEntendido } from '../../servicios';
import {
  coloresCategoria,
  coloresEscucha,
  espacio,
  familiaDeCategoria,
  formatearCentavos,
  FUENTE,
  Icono,
  iconoDeCategoria,
  OBJETIVO_TACTIL_MIN,
  Orbe,
  useCiclo,
  useReducirMovimiento,
  useTema,
} from '../../ui';
import { ETIQUETA_ESCUCHANDO, PISTA_ESCUCHANDO, type BotonHablar } from '../../voz';
import { useMedidasDock } from '../navegacion/DockVoz';
import {
  BTN_CANCELAR_ESCUCHA,
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
const ALTO_ONDA = 52;
const MICROFONO = 80;

/**
 * «Te escucho» (dirección B+, D2): la pantalla completa en verde pino mientras escucha. Arriba «Te escucho» y la X
 * (cancela); al centro el orbe grande con ondas y la frase en vivo; debajo «Voy entendiendo» con lo que el nivel 0 ya
 * sacó de la frase a medias (la cifra segura en menta, la categoría con su color, la cuenta que todavía no termina
 * con «…»); la onda de voz sigue el volumen si el reconocedor lo da y, si no, se anima sola; abajo el micrófono, que
 * termina al soltarlo (mantener) o al tocarlo (toque). Nada de esto va a logs (regla 9).
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
        <View
          accessibilityRole="header"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.s,
            backgroundColor: e.chip,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 7,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.chipListo }} />
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: '700',
              color: e.chipListo,
            }}
          >
            {ETIQUETA_TE_ESCUCHO}
          </Text>
        </View>
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
            backgroundColor: e.chip,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icono nombre="cerrar" color={e.texto} tamano={22} grosor={2.2} />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.xl }}>
        <Orbe tamano={200} estado="escuchando" testID="orbe-escucha" />
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={parcial === '' ? ETIQUETA_ESCUCHANDO : parcial}
          style={{
            fontFamily: FUENTE,
            fontSize: 32,
            lineHeight: 40,
            fontWeight: '800',
            letterSpacing: -0.4,
            textAlign: 'center',
            color: e.texto,
          }}
        >
          <Text testID="transcripcion-en-vivo">{frase}</Text>
          {/* El cursor de D2: la frase sigue creciendo. */}
          <Text style={{ fontFamily: FUENTE, fontWeight: '300', color: e.chipListo }}>|</Text>
        </Text>
      </View>

      <LoQueVoyEntendiendo entendido={entendido} />
      <OndaDeVoz suscribirVolumen={suscribirVolumen} />

      <View style={{ alignItems: 'center', gap: espacio.m, paddingTop: espacio.l }}>
        <View
          style={{
            width: MICROFONO + 48,
            height: MICROFONO + 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: MICROFONO + 48,
              height: MICROFONO + 48,
              borderRadius: (MICROFONO + 48) / 2,
              backgroundColor: e.chip,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: MICROFONO + 22,
              height: MICROFONO + 22,
              borderRadius: (MICROFONO + 22) / 2,
              backgroundColor: e.chip,
            }}
          />
          {/* Con un toque se terminó de escuchar aquí; mientras se mantiene, manda el micrófono del dock (debajo). */}
          <Pressable
            testID="boton-terminar-escucha"
            onPressIn={boton.alPresionarDentro}
            onPressOut={boton.alSoltar}
            accessibilityRole="button"
            accessibilityLabel={ETIQUETA_ESCUCHANDO}
            accessibilityHint={PISTA_ESCUCHANDO}
            style={({ pressed }) => ({
              width: MICROFONO,
              height: MICROFONO,
              borderRadius: MICROFONO / 2,
              backgroundColor: e.chipListo,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Icono nombre="microfono" color={e.sobreChipListo} tamano={34} grosor={2.1} />
          </Pressable>
        </View>
        <Text
          testID="pista-escucha"
          style={{
            fontFamily: FUENTE,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '600',
            color: e.textoSecundario,
          }}
        >
          {manteniendo ? PISTA_ESCUCHA_MANTENIENDO : PISTA_ESCUCHA_TOCANDO}
        </Text>
      </View>
    </View>
  );
}

/** «Voy entendiendo»: la cifra, la categoría y la cuenta que ya salen de la frase a medias (nivel 0, sin red). */
function LoQueVoyEntendiendo({ entendido }: { entendido: LoEntendido }) {
  const { esquema } = useTema();
  const e = coloresEscucha[esquema];
  const hay = entendido.monto !== null || entendido.categoria !== null || entendido.cuenta !== null;
  return (
    <View
      testID="voy-entendiendo"
      accessible={hay}
      {...(hay ? { accessibilityLabel: etiquetaLoEntendido(entendido) } : {})}
      style={{ alignItems: 'center', gap: espacio.s, minHeight: 72 }}
    >
      {hay ? (
        <>
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: '600',
              color: e.textoSecundario,
            }}
          >
            {TEXTO_VOY_ENTENDIENDO}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: espacio.s }}>
            {entendido.monto !== null ? (
              <Chip testID="entendido-monto" lleno>
                <Icono nombre="palomita" color={e.sobreChipListo} tamano={16} grosor={2.6} />
                <TextoChip color={e.sobreChipListo}>{formatearCentavos(entendido.monto)}</TextoChip>
              </Chip>
            ) : null}
            {entendido.meAlcanza ? (
              <Chip testID="entendido-me-alcanza">
                <TextoChip color={e.texto}>{CHIP_ME_ALCANZA_ENTENDIDO}</TextoChip>
              </Chip>
            ) : null}
            {entendido.categoria ? (
              <Chip testID="entendido-categoria">
                <MosaicoChico slug={entendido.categoria.slug} />
                <TextoChip color={e.texto}>{entendido.categoria.nombre}</TextoChip>
              </Chip>
            ) : null}
            {entendido.cuenta ? (
              <Chip testID="entendido-cuenta" tentativo={!entendido.cuenta.seguro}>
                <TextoChip color={e.texto}>
                  {entendido.cuenta.seguro ? entendido.cuenta.nombre : `${entendido.cuenta.nombre} …`}
                </TextoChip>
              </Chip>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Chip({
  children,
  lleno = false,
  tentativo = false,
  testID,
}: {
  children: ReactNode;
  lleno?: boolean;
  tentativo?: boolean;
  testID: string;
}) {
  const { esquema } = useTema();
  const e = coloresEscucha[esquema];
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        borderRadius: 20,
        paddingHorizontal: 14,
        backgroundColor: lleno ? e.chipListo : tentativo ? 'transparent' : e.chip,
        borderWidth: tentativo ? 1.5 : 0,
        borderColor: e.filoTentativo,
      }}
    >
      {children}
    </View>
  );
}

function TextoChip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Text style={{ fontFamily: FUENTE, fontSize: 16, lineHeight: 22, fontWeight: '700', color }}>
      {children}
    </Text>
  );
}

function MosaicoChico({ slug }: { slug: string }) {
  const p = coloresCategoria.claro[familiaDeCategoria(slug)];
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: p.mosaico,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icono nombre={iconoDeCategoria(slug)} color={p.icono} tamano={15} grosor={2} />
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
