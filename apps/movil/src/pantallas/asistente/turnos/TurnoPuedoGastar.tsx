import { useState } from 'react';
import { Text, View } from 'react-native';
import type { DatosPuedoGastar, Turno } from '../../../asistente/tipos';
import { mensajeError, obtenerPreferenciasAvisos } from '../../../servicios';
import { useSesion } from '../../../sesion/ProveedorSesion';
import { BotonPildora } from '../../../ui/componentes/BotonPildora';
import {
  FUENTE,
  BarraApilada,
  BarraDelDia,
  cifraEnPalabras,
  coloresDinero,
  espacio,
  etiquetaHablada,
  formatearCentavos,
  Orbe,
  Texto,
  useTema,
} from '../../../ui';
import { useNotificaciones } from '../../avisos/notificaciones';
import { avisoRecordatorio } from '../../me-alcanza/recordatorio';
import {
  ERROR_RECORDATORIO,
  MENSAJE_PERMISO_AVISOS,
  MENSAJE_SIN_AVISOS,
  PISTA_RECUERDAMELO,
} from '../../me-alcanza/textos';
import {
  BTN_COMO_LO_CALCULE,
  btnRecuerdamelo,
  lineaDivision,
  sublineaPuedoGastar,
  TEXTO_AL_DIA,
  TEXTO_HOY_NO_CAMBIA,
  TEXTO_NO_ES_ASESORIA_CORTO,
  textoRecordatorioListo,
  textoTeQuedanLibres,
  textoTienes,
  TITULO_CONTADO_HOY,
  tituloEsperarIngreso,
  tituloPuedoGastar,
} from '../textos';

/**
 * «¿Me alcanza?» contestado en la conversación (tablero B3, vivo en B+ D4): el veredicto con el orbe y qué pasa con
 * tu día, las dos opciones lado a lado (hoy de contado o esperar al ingreso) con lo que te quedaría al día y su barra,
 * «Cómo lo calculé» como barra apilada (apartado · colchón · la compra · libre) con la división del día, «Lo compré» y
 * «Recuérdamelo el vie 30». Con Plus, debajo, cómo llegas con cada opción y sus botones. Las cifras ya vienen de `core` en
 * `turno.puedoGastar` (regla 4); aquí solo se presentan.
 */
export function TurnoPuedoGastar({
  turno,
  datos,
  testID,
}: {
  turno: Extract<Turno, { clase: 'aviso' }>;
  datos: DatosPuedoGastar;
  testID: string;
}) {
  const { c, esquema } = useTema();
  const { ctx } = useSesion();
  const notificaciones = useNotificaciones();
  const [error, setError] = useState<string | null>(null);
  const [recordado, setRecordado] = useState(false);
  const [mensajeRecordatorio, setMensajeRecordatorio] = useState<string | null>(null);
  const [principal, ...otras] = turno.acciones;
  const falta = datos.faltante > 0;
  const proximo = datos.proximo;

  const tocar = (accion: () => void | Promise<void>) => {
    setError(null);
    Promise.resolve()
      .then(() => accion())
      .catch((e: unknown) => setError(mensajeError(e)));
  };

  const recordar = async () => {
    if (!proximo) return;
    setMensajeRecordatorio(null);
    if (!notificaciones) return setMensajeRecordatorio(MENSAJE_SIN_AVISOS);
    try {
      let permiso = await notificaciones.permiso();
      if (permiso === 'sin_preguntar') permiso = await notificaciones.pedirPermiso();
      if (permiso !== 'concedido') return setMensajeRecordatorio(MENSAJE_PERMISO_AVISOS);
      await notificaciones.puerto.programar(
        avisoRecordatorio(proximo.fecha, datos.que ?? undefined, obtenerPreferenciasAvisos(ctx)),
      );
      setRecordado(true);
    } catch {
      setMensajeRecordatorio(ERROR_RECORDATORIO);
    }
  };

  const opciones = [
    {
      clave: 'contado',
      titulo: TITULO_CONTADO_HOY,
      detalle: falta ? null : textoTeQuedanLibres(formatearCentavos(datos.libreDespues, 'pesos')),
      cifra: datos.despues,
      resaltada: false,
    },
    ...(proximo
      ? [
          {
            clave: 'esperar',
            titulo: tituloEsperarIngreso(proximo.etiqueta, proximo.concepto),
            detalle: TEXTO_HOY_NO_CAMBIA,
            cifra: datos.antes,
            resaltada: true,
          },
        ]
      : []),
  ];
  const sub = sublineaPuedoGastar({
    que: datos.que,
    monto: formatearCentavos(datos.precio),
    antes: formatearCentavos(datos.antes, 'pesos'),
    despues: formatearCentavos(datos.despues, 'pesos'),
    faltante: falta ? formatearCentavos(datos.faltante) : null,
    proximo,
  });
  const dinero = coloresDinero[esquema];
  const nombreCompra = datos.que ? `${datos.que.charAt(0).toUpperCase()}${datos.que.slice(1)}` : 'La compra';
  const partes = [
    { clave: 'reservado', etiqueta: 'Apartado', centavos: datos.reservado.monto, color: dinero.apartado },
    { clave: 'colchon', etiqueta: 'Colchón', centavos: datos.colchon, color: dinero.colchon },
    { clave: 'compra', etiqueta: nombreCompra, centavos: datos.precio, color: dinero.compra },
    { clave: 'libre', etiqueta: 'Libre', centavos: Math.max(0, datos.libreDespues), color: dinero.libre },
  ];
  const division = lineaDivision(
    formatearCentavos(Math.max(0, datos.libreDespues), 'pesos'),
    datos.dias,
    formatearCentavos(datos.despues, 'pesos'),
  );

  return (
    <View testID={testID} style={{ gap: 14 }}>
      {/* D4: el veredicto con el orbe y, debajo, qué pasa con tu día. */}
      <View
        testID={`${testID}-texto`}
        accessible
        accessibilityLabel={etiquetaHablada(turno.texto)}
        style={{ gap: espacio.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Orbe tamano={34} estado="quieto" testID={`${testID}-orbe`} />
          <Text
            style={{
              fontFamily: FUENTE,
              flexShrink: 1,
              fontSize: 26,
              lineHeight: 32,
              fontWeight: '800',
              color: falta ? c.faltante : c.texto,
            }}
          >
            {tituloPuedoGastar(falta)}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: FUENTE,
            fontSize: 17,
            lineHeight: 24,
            color: c.texto,
            paddingLeft: 34 + espacio.s,
          }}
        >
          {sub.antes}
          <Text style={{ fontFamily: FUENTE, fontWeight: '800', color: falta ? c.faltante : c.acentoTexto }}>
            {sub.cifra}
          </Text>
          {sub.final}
        </Text>
      </View>
      <View testID={`${testID}-opciones`} style={{ flexDirection: 'row', gap: 10 }}>
        {opciones.map((o) => (
          <View
            key={o.clave}
            accessible
            accessibilityLabel={`${o.titulo}. ${o.detalle ? `${etiquetaHablada(o.detalle)}. ` : ''}${cifraEnPalabras(o.cifra, 'pesos')} al día`}
            testID={`${testID}-opcion-${o.clave}`}
            style={{
              flex: 1,
              backgroundColor: c.superficie,
              borderRadius: 22,
              borderWidth: o.resaltada ? 2 : 1,
              borderColor: o.resaltada ? c.microfono : c.borde,
              padding: 14,
              gap: espacio.s,
            }}
          >
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 14,
                lineHeight: 19,
                fontWeight: '700',
                color: c.textoSecundario,
              }}
            >
              {o.titulo}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 4 }}>
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 30,
                  lineHeight: 36,
                  fontWeight: '800',
                  color: o.resaltada ? c.acentoTexto : c.texto,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatearCentavos(o.cifra, 'pesos')}
              </Text>
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: '600',
                  color: c.textoSecundario,
                }}
              >
                {TEXTO_AL_DIA}
              </Text>
            </View>
            {/* Lo que queda al día frente a hoy sin comprar: la barra se recorta (D4). */}
            <BarraDelDia
              antes={datos.antes}
              despues={o.cifra}
              lleno={o.resaltada ? dinero.libre : dinero.apartado}
              recorte={c.superficieAlterna}
              riel={c.superficieAlterna}
            />
            {o.detalle ? (
              <Text style={{ fontFamily: FUENTE, fontSize: 13, lineHeight: 18, color: c.textoSecundario }}>
                {o.detalle}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {turno.detalle ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-detalle`}>
          {turno.detalle}
        </Texto>
      ) : null}
      {/* D4: «Cómo lo calculé» como barra apilada; las cifras son las de E4 con la compra restada. */}
      <View
        testID={`${testID}-calculo`}
        style={{
          backgroundColor: c.superficie,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: c.borde,
          padding: espacio.l,
          gap: espacio.m,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            columnGap: espacio.s,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontFamily: FUENTE, fontSize: 15, lineHeight: 20, fontWeight: '700', color: c.texto }}
          >
            {BTN_COMO_LO_CALCULE}
          </Text>
          <Text
            testID="calculo-liquidez"
            accessibilityLabel={`Tienes ${cifraEnPalabras(datos.tienes.monto, 'pesos')}`}
            style={{
              fontFamily: FUENTE,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: '800',
              color: c.texto,
              fontVariant: ['tabular-nums'],
            }}
          >
            {textoTienes(formatearCentavos(datos.tienes.monto, 'pesos'))}
          </Text>
        </View>
        <BarraApilada
          testID={`${testID}-barra`}
          partes={partes.map((p) => ({ clave: p.clave, valor: p.centavos, color: p.color }))}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: espacio.s, columnGap: espacio.l }}>
          {partes.map((p) => (
            <View
              key={p.clave}
              accessible
              accessibilityLabel={`${etiquetaHablada(p.etiqueta)}: ${cifraEnPalabras(p.centavos, 'pesos')}`}
              testID={`calculo-${p.clave}`}
              style={{ flexBasis: '45%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: p.color }} />
              <Text style={{ fontFamily: FUENTE, flex: 1, fontSize: 15, lineHeight: 21, color: c.texto }}>
                {p.etiqueta}
              </Text>
              <Text
                style={{
                  fontFamily: FUENTE,
                  fontSize: 15,
                  lineHeight: 21,
                  fontWeight: '800',
                  color: p.clave === 'libre' ? c.acentoTexto : c.texto,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatearCentavos(p.centavos, 'pesos')}
              </Text>
            </View>
          ))}
        </View>
        <Text
          testID={`${testID}-division`}
          accessibilityLabel={etiquetaHablada(`${division.cuenta}${division.resultado}`)
            .replace('÷', 'entre')
            .replace('=', 'son')}
          style={{
            fontFamily: FUENTE,
            fontSize: 15,
            lineHeight: 21,
            fontWeight: '600',
            color: c.texto,
            paddingTop: espacio.m,
            borderTopWidth: 1,
            borderTopColor: c.superficieAlterna,
          }}
        >
          {division.cuenta}
          <Text style={{ fontFamily: FUENTE, fontWeight: '800', color: c.acentoTexto }}>
            {division.resultado}
          </Text>
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {principal ? (
          <BotonPildora
            etiqueta={principal.etiqueta}
            variante="lleno"
            alto={52}
            alPresionar={() => tocar(principal.accion)}
            {...(principal.testID ? { testID: principal.testID } : {})}
            {...(principal.pista ? { pista: principal.pista } : {})}
          />
        ) : null}
        {proximo && !recordado ? (
          <BotonPildora
            etiqueta={btnRecuerdamelo(proximo.etiqueta)}
            alto={52}
            ancho="lleno"
            pista={PISTA_RECUERDAMELO}
            alPresionar={() => void recordar()}
            testID={`${testID}-recordar`}
          />
        ) : null}
        {otras.map((a) => (
          <BotonPildora
            key={a.etiqueta}
            etiqueta={a.etiqueta}
            alto={46}
            alPresionar={() => tocar(a.accion)}
            {...(a.testID ? { testID: a.testID } : {})}
            {...(a.pista ? { pista: a.pista } : {})}
          />
        ))}
      </View>
      {recordado && proximo ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-recordado`}>
          {textoRecordatorioListo(proximo.etiqueta)}
        </Texto>
      ) : null}
      {mensajeRecordatorio ? (
        <Texto variante="secundario" tono="secundario" accessibilityRole="alert">
          {mensajeRecordatorio}
        </Texto>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
      <Texto variante="pequeno" tono="secundario">
        {TEXTO_NO_ES_ASESORIA_CORTO}
      </Texto>
    </View>
  );
}
