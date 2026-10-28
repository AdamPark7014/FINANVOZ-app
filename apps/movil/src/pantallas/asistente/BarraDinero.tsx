import { Pressable, Text, View } from 'react-native';
import { barraDinero, type VistaHoy } from '../../servicios';
import {
  BarraApilada,
  cifraEnPalabras,
  coloresDinero,
  espacio,
  FUENTE,
  formatearCentavos,
  Icono,
  OBJETIVO_TACTIL_MIN,
  useTema,
} from '../../ui';
import { PISTA_OCULTAR_DESGLOSE, PISTA_VER_DESGLOSE, PISTA_VER_QUE_VIENE } from '../principal/textos';
import { BTN_COMO_LO_CALCULE, ETIQUETA_PARTE_DINERO, textoDeTus } from './textos';

/**
 * Tu dinero en una barra (dirección B+, D1 y D7): «De tus $5,249», la barra apartado · colchón · libre y su leyenda
 * con cada cifra. Si lo apartado y el colchón no caben en lo que tienes, la barra pinta lo cubierto y el faltante en
 * rojo («Faltan $700»). «Cómo lo calculé ›» (`boton-desglose`) abre y cierra el mismo desglose de siempre. El reparto
 * sale de `barraDinero` (el desglose de E4 en `VistaHoy`, regla 4): aquí solo se dibuja a lo ancho.
 */
export function BarraDinero({
  vista,
  abierto,
  alPresionar,
}: {
  vista: VistaHoy;
  abierto: boolean;
  alPresionar: () => void;
}) {
  const { c, esquema } = useTema();
  const dinero = coloresDinero[esquema];
  const color = (clave: 'apartado' | 'colchon' | 'libre' | 'faltante') =>
    clave === 'faltante' ? c.faltante : dinero[clave];
  const { total, tramos, leyenda } = barraDinero(vista);
  const negativo = vista.estado === 'libre_negativo';
  const deTus = textoDeTus(formatearCentavos(total, 'pesos'));
  return (
    <View
      testID="barra-dinero"
      style={{
        backgroundColor: c.superficie,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borde,
        paddingHorizontal: espacio.l,
        paddingTop: espacio.m,
        paddingBottom: espacio.l,
        gap: espacio.m,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          columnGap: espacio.s,
        }}
      >
        <Text
          testID="barra-dinero-total"
          accessibilityRole="header"
          accessibilityLabel={`De tus ${cifraEnPalabras(total, 'pesos')}`}
          style={{
            fontFamily: FUENTE,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '600',
            color: c.textoSecundario,
          }}
        >
          {deTus}
        </Text>
        <Pressable
          testID="boton-desglose"
          onPress={alPresionar}
          // D1: la cabecera es baja; el área de toque llega a 48 con `hitSlop`.
          hitSlop={{ top: espacio.s, bottom: espacio.s, left: espacio.s, right: espacio.s }}
          accessibilityRole="button"
          accessibilityLabel={BTN_COMO_LO_CALCULE}
          accessibilityHint={
            abierto ? PISTA_OCULTAR_DESGLOSE : negativo ? PISTA_VER_QUE_VIENE : PISTA_VER_DESGLOSE
          }
          accessibilityState={{ expanded: abierto }}
          style={({ pressed }) => ({
            minHeight: OBJETIVO_TACTIL_MIN - espacio.l,
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.xxs,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            importantForAccessibility="no"
            style={{
              fontFamily: FUENTE,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: '700',
              color: c.acentoTexto,
            }}
          >
            {BTN_COMO_LO_CALCULE}
          </Text>
          <View style={{ transform: [{ rotate: abierto ? '90deg' : '0deg' }] }}>
            <Icono nombre="chevronDerecha" color={c.acentoTexto} tamano={18} grosor={2.4} />
          </View>
        </Pressable>
      </View>
      <BarraApilada
        testID="barra-dinero-barra"
        partes={tramos.map((p) => ({ clave: p.clave, valor: p.centavos, color: color(p.clave) }))}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: espacio.s }}>
        {leyenda.map((p) => (
          <View
            key={p.clave}
            accessible
            accessibilityLabel={`${ETIQUETA_PARTE_DINERO[p.clave]}: ${cifraEnPalabras(p.centavos, p.clave === 'faltante' ? 'auto' : 'pesos')}`}
            testID={`barra-dinero-${p.clave}`}
            style={{ flexGrow: 1, flexBasis: '30%', gap: 2 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color(p.clave) }} />
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 14,
                  lineHeight: 20,
                  fontWeight: p.clave === 'faltante' ? '700' : '400',
                  color: p.clave === 'faltante' ? c.faltante : c.textoSecundario,
                }}
              >
                {ETIQUETA_PARTE_DINERO[p.clave]}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 18,
                lineHeight: 24,
                fontWeight: '800',
                color: p.clave === 'libre' ? c.acentoTexto : p.clave === 'faltante' ? c.faltante : c.texto,
                fontVariant: ['tabular-nums'],
              }}
            >
              {/* El faltante con sus centavos, como en «Te faltan…» de arriba: nunca se redondea hacia abajo. */}
              {formatearCentavos(p.centavos, p.clave === 'faltante' ? 'auto' : 'pesos')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
