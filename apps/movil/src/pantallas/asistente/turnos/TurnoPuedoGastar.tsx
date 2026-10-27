import { useState } from 'react';
import { Text, View } from 'react-native';
import type { DatosPuedoGastar, Turno } from '../../../asistente/tipos';
import { mensajeError, obtenerPreferenciasAvisos } from '../../../servicios';
import { useSesion } from '../../../sesion/ProveedorSesion';
import { BotonPildora } from '../../../ui/componentes/BotonPildora';
import { cifraEnPalabras, espacio, etiquetaHablada, formatearCentavos, Texto, useTema } from '../../../ui';
import { useNotificaciones } from '../../avisos/notificaciones';
import { avisoRecordatorio } from '../../me-alcanza/recordatorio';
import {
  ERROR_RECORDATORIO,
  MENSAJE_PERMISO_AVISOS,
  MENSAJE_SIN_AVISOS,
  PISTA_RECUERDAMELO,
} from '../../me-alcanza/textos';
import { TarjetaCalculo } from '../TarjetaCalculo';
import {
  btnRecuerdamelo,
  filasCalculoCompra,
  TEXTO_AL_DIA,
  TEXTO_HOY_NO_CAMBIA,
  TEXTO_NO_ES_ASESORIA_CORTO,
  textoRecordatorioListo,
  textoTeQuedanLibres,
  TITULO_CONTADO_HOY,
  tituloEsperarIngreso,
} from '../textos';

/**
 * «¿Me alcanza?» contestado en la conversación (tablero B3): la respuesta en texto grande, las dos opciones (hoy de
 * contado o esperar al ingreso) con lo que te quedaría al día, «Cómo lo calculé», «Lo compré» y «Recuérdamelo el
 * vie 30». Con Plus, debajo, cómo llegas con cada opción y sus botones. Las cifras ya vienen de `core` en
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
  const { c } = useTema();
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
    },
    ...(proximo
      ? [
          {
            clave: 'esperar',
            titulo: tituloEsperarIngreso(proximo.etiqueta, proximo.concepto),
            detalle: TEXTO_HOY_NO_CAMBIA,
            cifra: datos.antes,
          },
        ]
      : []),
  ];

  return (
    <View testID={testID} style={{ gap: 14 }}>
      <Texto
        testID={`${testID}-texto`}
        style={{ fontSize: 21, lineHeight: 28, fontWeight: '600', color: falta ? c.faltante : c.texto }}
      >
        {turno.texto}
      </Texto>
      <View
        testID={`${testID}-opciones`}
        style={{
          backgroundColor: c.superficie,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: c.borde,
          paddingHorizontal: 18,
          paddingVertical: espacio.xs,
        }}
      >
        {opciones.map((o, i) => (
          <View
            key={o.clave}
            accessible
            accessibilityLabel={`${o.titulo}. ${o.detalle ? `${etiquetaHablada(o.detalle)}. ` : ''}${cifraEnPalabras(o.cifra, 'pesos')} al día`}
            testID={`${testID}-opcion-${o.clave}`}
            style={{
              minHeight: 62,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: espacio.m,
              paddingVertical: espacio.s,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.borde,
            }}
          >
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '700', color: c.texto }}>
                {o.titulo}
              </Text>
              {o.detalle ? (
                <Text style={{ fontSize: 14, lineHeight: 20, color: c.textoSecundario }}>{o.detalle}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: 24,
                  lineHeight: 30,
                  fontWeight: '800',
                  color: c.texto,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatearCentavos(o.cifra, 'pesos')}
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: c.textoSecundario }}>{TEXTO_AL_DIA}</Text>
            </View>
          </View>
        ))}
      </View>
      {turno.detalle ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-detalle`}>
          {turno.detalle}
        </Texto>
      ) : null}
      <TarjetaCalculo filas={filasCalculoCompra(datos)} testID={`${testID}-calculo`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {principal ? (
          <BotonPildora
            etiqueta={principal.etiqueta}
            variante="lleno"
            alto={46}
            alPresionar={() => tocar(principal.accion)}
            {...(principal.testID ? { testID: principal.testID } : {})}
            {...(principal.pista ? { pista: principal.pista } : {})}
          />
        ) : null}
        {proximo && !recordado ? (
          <BotonPildora
            etiqueta={btnRecuerdamelo(proximo.etiqueta)}
            alto={46}
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
