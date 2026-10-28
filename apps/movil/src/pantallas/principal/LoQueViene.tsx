import { partes, diaSemana } from '@cartera/core';
import { Pressable, Text, View } from 'react-native';
import { etiquetaFecha, type ProximoMovimiento } from '../../servicios';
import {
  cifraEnPalabras,
  coloresCategoria,
  espacio,
  formatearCentavos,
  FUENTE,
  OBJETIVO_TACTIL_MIN,
  useTema,
} from '../../ui';
import { etiquetaFila, PISTA_ABRIR_COMPROMISO } from '../cuentas/textos';
import { contextoSaldoCompromiso, etiquetaIngresoQueViene, tituloIngresoQueViene } from './textos';

const DIAS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] as const;
const CUADRO = 46;

/**
 * «Lo que viene» como línea de tiempo (dirección B+, D6): cada pago fijo e ingreso de los próximos 30 días con su día
 * en un cuadro («MIÉ 28»), unidos por una línea; los pagos con «−$499» y el ingreso en verde con «+$13,000». Cada pago
 * abre su detalle (`compromiso-<id>-abrir`). Los datos vienen de `listarCuentas().loQueViene`.
 */
export function LoQueViene({
  items,
  alAbrirPagoFijo,
}: {
  items: readonly ProximoMovimiento[];
  alAbrirPagoFijo?: (programadoId: string) => void;
}) {
  return (
    <View accessibilityRole="list" testID="seccion-compromisos-lista">
      {items.map((x, i) =>
        x.tipo === 'egreso' ? (
          <Pago
            key={`${x.programadoId}:${x.fecha}`}
            x={x}
            ultimo={i === items.length - 1}
            {...(alAbrirPagoFijo ? { alAbrir: () => alAbrirPagoFijo(x.programadoId) } : {})}
          />
        ) : (
          <Ingreso key={`${x.programadoId}:${x.fecha}`} x={x} ultimo={i === items.length - 1} />
        ),
      )}
    </View>
  );
}

function CuadroDia({ fecha, ingreso, ultimo }: { fecha: string; ingreso: boolean; ultimo: boolean }) {
  const { c, esquema } = useTema();
  const verde = coloresCategoria[esquema].super;
  const f = fecha as Parameters<typeof partes>[0];
  return (
    <View style={{ width: CUADRO, alignItems: 'center', alignSelf: 'stretch' }}>
      <View
        style={{
          width: CUADRO,
          height: CUADRO,
          borderRadius: 12,
          backgroundColor: ingreso ? verde.mosaico : c.superficieAlterna,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: FUENTE,
            fontSize: 10,
            lineHeight: 13,
            fontWeight: '700',
            color: ingreso ? verde.icono : c.textoSecundario,
          }}
        >
          {DIAS[diaSemana(f) - 1]}
        </Text>
        <Text
          style={{
            fontFamily: FUENTE,
            fontSize: 17,
            lineHeight: 20,
            fontWeight: '800',
            color: ingreso ? verde.icono : c.texto,
            fontVariant: ['tabular-nums'],
          }}
        >
          {partes(f).dia}
        </Text>
      </View>
      {/* La línea que une un día con el siguiente. */}
      {ultimo ? null : <View style={{ flex: 1, width: 2, minHeight: espacio.s, backgroundColor: c.borde }} />}
    </View>
  );
}

function Pago({ x, ultimo, alAbrir }: { x: ProximoMovimiento; ultimo: boolean; alAbrir?: () => void }) {
  const { c } = useTema();
  const fecha = etiquetaFecha(x.fecha);
  const contexto = contextoSaldoCompromiso(x.concepto, fecha);
  const renglon = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m }}>
      <CuadroDia fecha={x.fecha} ingreso={false} ultimo={ultimo} />
      <View
        style={{
          flex: 1,
          minHeight: CUADRO,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Text
          style={{
            fontFamily: FUENTE,
            flexShrink: 1,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '600',
            color: c.texto,
          }}
        >
          {mayuscula(x.concepto)}
        </Text>
        {/* D6: «−$499»; el lector oye «Pago de internet el mié 28 cuatrocientos noventa y nueve pesos». */}
        <Text
          testID={`compromiso-${x.programadoId}-saldo`}
          accessible
          accessibilityLabel={`${contexto} ${cifraEnPalabras(x.monto)}`}
          style={{
            fontFamily: FUENTE,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '800',
            color: c.texto,
            fontVariant: ['tabular-nums'],
          }}
        >
          {`−${formatearCentavos(x.monto)}`}
        </Text>
      </View>
    </View>
  );
  return (
    <View role="listitem" testID={`compromiso-${x.programadoId}`} style={{ paddingTop: 2 }}>
      {alAbrir ? (
        <Pressable
          testID={`compromiso-${x.programadoId}-abrir`}
          onPress={alAbrir}
          accessibilityRole="button"
          accessibilityLabel={etiquetaFila({
            titulo: x.concepto,
            subtitulo: fecha,
            contexto,
            centavos: x.monto,
          })}
          accessibilityHint={PISTA_ABRIR_COMPROMISO}
          style={({ pressed }) => ({ minHeight: OBJETIVO_TACTIL_MIN, opacity: pressed ? 0.7 : 1 })}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {renglon}
          </View>
        </Pressable>
      ) : (
        renglon
      )}
    </View>
  );
}

function Ingreso({ x, ultimo }: { x: ProximoMovimiento; ultimo: boolean }) {
  const { c } = useTema();
  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={etiquetaIngresoQueViene(x.concepto, etiquetaFecha(x.fecha), x.monto)}
      testID={`ingreso-${x.programadoId}-${x.fecha}`}
      style={{ paddingTop: 2, flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m }}
    >
      <CuadroDia fecha={x.fecha} ingreso ultimo={ultimo} />
      <View
        style={{
          flex: 1,
          minHeight: CUADRO,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Text
          style={{
            fontFamily: FUENTE,
            flexShrink: 1,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '700',
            color: c.acentoTexto,
          }}
        >
          {tituloIngresoQueViene(x.concepto)}
        </Text>
        <Text
          style={{
            fontFamily: FUENTE,
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '800',
            color: c.acentoTexto,
            fontVariant: ['tabular-nums'],
          }}
        >
          {`+${formatearCentavos(x.monto)}`}
        </Text>
      </View>
    </View>
  );
}

function mayuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
