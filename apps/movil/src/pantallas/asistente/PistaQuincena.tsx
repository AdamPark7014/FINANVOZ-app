import { Text, View } from 'react-native';
import type { DiaPista, PistaQuincena as DatosPista } from '../../servicios';
import { coloresCategoria, espacio, FUENTE, useTema } from '../../ui';
import {
  etiquetaDiaPista,
  lineasEventoPista,
  TEXTO_HOY_PISTA,
  TEXTO_NADA_FIJO,
  textoDiasPista,
  tituloPista,
} from './textos';

/** Diámetro de cada día (D1). */
const CIRCULO = 38;

/**
 * La pista a la quincena (dirección B+, D1 y D7): los días de hoy al próximo ingreso, cada uno con lo que cae ese día
 * (pagos fijos en negro, el pago de la tarjeta en violeta, el ingreso en verde). Los datos ya vienen de
 * `pistaQuincena` (ocurrencias y E5): aquí solo se acomodan. Cada día se lee entero («Jueves 29: tanda, menos
 * quinientos pesos; pagar Nu…»).
 */
export function PistaQuincena({ pista }: { pista: DatosPista }) {
  const { c, esquema } = useTema();
  const insignia = coloresCategoria[esquema].super;
  return (
    <View
      testID="pista-quincena"
      style={{
        backgroundColor: c.superficie,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borde,
        paddingHorizontal: espacio.l,
        paddingVertical: espacio.m,
        gap: espacio.m,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
          flexWrap: 'wrap',
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: FUENTE,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '600',
            color: c.textoSecundario,
          }}
        >
          {tituloPista(pista.concepto)}
        </Text>
        <View
          testID="pista-dias"
          style={{
            backgroundColor: insignia.mosaico,
            borderRadius: 999,
            paddingHorizontal: espacio.m,
            paddingVertical: espacio.xxs + 1,
          }}
        >
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: '700',
              color: insignia.icono,
            }}
          >
            {textoDiasPista(pista.diasAlIngreso)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }} accessibilityRole="list">
        {pista.columnas.map((d, i) => (
          <Columna key={d.fecha} d={d} primera={i === 0} ultima={i === pista.columnas.length - 1} />
        ))}
      </View>
    </View>
  );
}

function Columna({ d, primera, ultima }: { d: DiaPista; primera: boolean; ultima: boolean }) {
  const { c, esquema } = useTema();
  const violeta = coloresCategoria[esquema].salidas.icono;
  const relleno = d.hoy
    ? esquema === 'oscuro'
      ? c.texto
      : c.acento
    : d.ingreso
      ? c.microfono
      : c.superficie;
  const numero = d.hoy
    ? esquema === 'oscuro'
      ? c.fondo
      : c.sobreAcento
    : d.ingreso
      ? c.sobreMicrofono
      : c.texto;
  return (
    <View
      accessible
      role="listitem"
      accessibilityLabel={etiquetaDiaPista(d)}
      testID={`pista-dia-${d.fecha}`}
      style={{ flex: 1, alignItems: 'center', gap: 6 }}
    >
      <Text
        style={{
          fontFamily: FUENTE,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: d.hoy ? '800' : '600',
          letterSpacing: 0.4,
          color: d.hoy ? c.acentoTexto : c.textoSecundario,
        }}
      >
        {d.hoy ? TEXTO_HOY_PISTA.toUpperCase() : d.diaSemana.toUpperCase()}
      </Text>
      <View style={{ width: '100%', height: CIRCULO, alignItems: 'center', justifyContent: 'center' }}>
        {/* La línea que une los días pasa por detrás de los círculos. */}
        {primera ? null : (
          <View
            style={{ position: 'absolute', left: 0, right: '50%', height: 2, backgroundColor: c.borde }}
          />
        )}
        {ultima ? null : (
          <View
            style={{ position: 'absolute', left: '50%', right: 0, height: 2, backgroundColor: c.borde }}
          />
        )}
        <View
          style={{
            width: CIRCULO,
            height: CIRCULO,
            borderRadius: CIRCULO / 2,
            backgroundColor: relleno,
            borderWidth: d.hoy || d.ingreso ? 0 : 1.5,
            borderColor: c.borde,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 16,
              lineHeight: 20,
              fontWeight: '800',
              color: numero,
              fontVariant: ['tabular-nums'],
            }}
          >
            {d.dia}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 1, paddingHorizontal: 2 }}>
        {d.eventos.length === 0 ? (
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 13,
              lineHeight: 17,
              textAlign: 'center',
              color: c.textoSecundario,
            }}
          >
            {d.hoy ? d.diaSemana : TEXTO_NADA_FIJO}
          </Text>
        ) : (
          d.eventos.map((e, i) => {
            const l = lineasEventoPista(e);
            const color = e.tipo === 'tarjeta' ? violeta : e.tipo === 'ingreso' ? c.acentoTexto : c.texto;
            return (
              <View key={`${e.tipo}-${e.concepto}-${i}`} style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: FUENTE,
                    fontSize: 13,
                    lineHeight: 17,
                    textAlign: 'center',
                    fontWeight: e.tipo === 'egreso' ? '500' : '700',
                    color: e.tipo === 'egreso' ? c.textoSecundario : color,
                  }}
                >
                  {l.concepto}
                </Text>
                {l.cifra ? (
                  <Text
                    style={{
                      fontFamily: FUENTE,
                      fontSize: 13,
                      lineHeight: 17,
                      fontWeight: '800',
                      color,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {l.cifra}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
