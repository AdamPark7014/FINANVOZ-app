import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fijarPreferenciasAvisos, obtenerPreferenciasAvisos, type PreferenciasAvisos } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { useNotificaciones, type PermisoAvisos } from '../avisos/notificaciones';
import {
  AVISO_COMPROMISO,
  AVISO_CORTE,
  AVISO_INGRESO,
  AVISO_LIMITE,
  AVISO_RESPALDO,
  AVISO_RIESGO,
  AVISO_TANDA,
  AVISOS_APAGADOS_EN_TELEFONO,
  BTN_ABRIR_AJUSTES_TELEFONO,
  BTN_GUARDAR_HORARIO,
  BTN_PERMITIR_AVISOS,
  CONFIRMACION_HORARIO,
  DESC_COMPROMISO,
  DESC_CORTE,
  DESC_HORARIO_SILENCIOSO,
  DESC_INGRESO,
  DESC_LIMITE,
  DESC_RESPALDO,
  DESC_RIESGO,
  DESC_TANDA,
  EJEMPLO_HORA_AVISOS,
  EJEMPLO_SILENCIO_DESDE,
  EJEMPLO_SILENCIO_HASTA,
  ERROR_FORMATO_HORA,
  ETIQUETA_HORA_AVISOS,
  ETIQUETA_HORARIO_SILENCIOSO,
  ETIQUETA_SILENCIO_DESDE,
  ETIQUETA_SILENCIO_HASTA,
  SECCION_AVISOS,
} from './avisos-textos';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "9:00" → "09:00"; lo demás se queda igual para que el servicio lo rechace con su mensaje. */
function normalizarHora(texto: string): string {
  const t = texto.trim();
  return /^\d:\d\d$/.test(t) ? `0${t}` : t;
}

/**
 * Ajustes → Avisos (`02 §12`, `02 §13`): qué avisos salen (tarjetas, riesgo, respaldo, tandas, pagos e ingresos), a qué hora y el horario silencioso. Cada
 * cambio se guarda en servicios y la sincronización vuelve a programar los avisos del teléfono.
 */
export function SeccionAvisos() {
  const { ctx, refrescar } = useSesion();
  const notificaciones = useNotificaciones();
  const pref = useVista(obtenerPreferenciasAvisos);
  const [permiso, setPermiso] = useState<PermisoAvisos | null>(null);
  const [hora, setHora] = useState(pref.hora);
  const [inicio, setInicio] = useState(pref.silencio.inicio);
  const [fin, setFin] = useState(pref.silencio.fin);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!notificaciones) return;
    let vigente = true;
    notificaciones
      .permiso()
      .then((p) => vigente && setPermiso(p))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [notificaciones]);

  const guardar = (cambios: Partial<PreferenciasAvisos>, confirmacion?: string) => {
    try {
      fijarPreferenciasAvisos(ctx, cambios);
      setMensaje(confirmacion ?? null);
      refrescar();
    } catch {
      setMensaje(ERROR_FORMATO_HORA);
    }
  };

  const guardarHorario = () => {
    const h = normalizarHora(hora);
    const i = normalizarHora(inicio);
    const f = normalizarHora(fin);
    if (![h, i, f].every((x) => HORA.test(x))) {
      setMensaje(ERROR_FORMATO_HORA);
      return;
    }
    guardar({ hora: h, silencio: { inicio: i, fin: f } }, CONFIRMACION_HORARIO);
  };

  return (
    <Tarjeta testID="ajustes-avisos">
      <Texto variante="subtitulo">{SECCION_AVISOS}</Texto>
      {permiso !== null && permiso !== 'concedido' && notificaciones ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario" testID="ajustes-avisos-sin-permiso">
            {AVISOS_APAGADOS_EN_TELEFONO}
          </Texto>
          <Boton
            testID="ajustes-avisos-permitir"
            variante="secundario"
            etiqueta={permiso === 'sin_preguntar' ? BTN_PERMITIR_AVISOS : BTN_ABRIR_AJUSTES_TELEFONO}
            alPresionar={() => {
              if (permiso === 'denegado') {
                notificaciones.abrirAjustesSistema?.();
                return;
              }
              notificaciones
                .pedirPermiso()
                .then((p) => {
                  setPermiso(p);
                  refrescar();
                })
                .catch(() => undefined);
            }}
          />
        </View>
      ) : null}
      <Interruptor
        testID="ajustes-aviso-corte"
        etiqueta={AVISO_CORTE}
        descripcion={DESC_CORTE}
        valor={pref.corte}
        alCambiar={(corte) => guardar({ corte })}
      />
      <Interruptor
        testID="ajustes-aviso-limite"
        etiqueta={AVISO_LIMITE}
        descripcion={DESC_LIMITE}
        valor={pref.fechaLimite}
        alCambiar={(fechaLimite) => guardar({ fechaLimite })}
      />
      <Interruptor
        testID="ajustes-aviso-riesgo"
        etiqueta={AVISO_RIESGO}
        descripcion={DESC_RIESGO}
        valor={pref.riesgo}
        alCambiar={(riesgo) => guardar({ riesgo })}
      />
      <Interruptor
        testID="ajustes-aviso-respaldo"
        etiqueta={AVISO_RESPALDO}
        descripcion={DESC_RESPALDO}
        valor={pref.respaldo}
        alCambiar={(respaldo) => guardar({ respaldo })}
      />
      <Interruptor
        testID="ajustes-aviso-tanda"
        etiqueta={AVISO_TANDA}
        descripcion={DESC_TANDA}
        valor={pref.tanda}
        alCambiar={(tanda) => guardar({ tanda })}
      />
      <Interruptor
        testID="ajustes-aviso-compromiso"
        etiqueta={AVISO_COMPROMISO}
        descripcion={DESC_COMPROMISO}
        valor={pref.compromiso}
        alCambiar={(compromiso) => guardar({ compromiso })}
      />
      <Interruptor
        testID="ajustes-aviso-ingreso"
        etiqueta={AVISO_INGRESO}
        descripcion={DESC_INGRESO}
        valor={pref.ingreso}
        alCambiar={(ingreso) => guardar({ ingreso })}
      />
      <CampoTexto
        testID="ajustes-aviso-hora"
        etiqueta={ETIQUETA_HORA_AVISOS}
        ejemplo={EJEMPLO_HORA_AVISOS}
        valor={hora}
        alCambiar={setHora}
        nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
      />
      <Texto variante="etiqueta">{ETIQUETA_HORARIO_SILENCIOSO}</Texto>
      <Texto variante="secundario" tono="secundario">
        {DESC_HORARIO_SILENCIOSO}
      </Texto>
      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        <View style={{ flex: 1 }}>
          <CampoTexto
            testID="ajustes-silencio-inicio"
            etiqueta={ETIQUETA_SILENCIO_DESDE}
            ejemplo={EJEMPLO_SILENCIO_DESDE}
            valor={inicio}
            alCambiar={setInicio}
            nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CampoTexto
            testID="ajustes-silencio-fin"
            etiqueta={ETIQUETA_SILENCIO_HASTA}
            ejemplo={EJEMPLO_SILENCIO_HASTA}
            valor={fin}
            alCambiar={setFin}
            nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
          />
        </View>
      </View>
      <Boton
        testID="ajustes-guardar-horario"
        variante="secundario"
        etiqueta={BTN_GUARDAR_HORARIO}
        alPresionar={guardarHorario}
      />
      {mensaje ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID="ajustes-avisos-mensaje"
        >
          {mensaje}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
