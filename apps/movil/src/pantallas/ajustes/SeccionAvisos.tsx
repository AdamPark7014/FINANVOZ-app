import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { fijarPreferenciasAvisos, obtenerPreferenciasAvisos, type PreferenciasAvisos } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, GrupoChips, OCULTAR_ETIQUETA_VISIBLE, Texto } from '../../ui';
import { CeldaGrupo, FilaInterruptor, Grupo } from '../../ui/componentes/Lista';
import { anunciar } from '../../ui/anunciar';
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
  BTN_PERMITIR_AVISOS,
  CONFIRMACION_HORARIO,
  DESC_HORARIO_SILENCIOSO,
  DESC_COMPROMISO,
  DESC_CORTE,
  DESC_INGRESO,
  DESC_LIMITE,
  DESC_RESPALDO,
  DESC_RIESGO,
  DESC_TANDA,
  ETIQUETA_AVISOS_APAGADOS_TELEFONO,
  ETIQUETA_BLOQUE_HORARIO_SILENCIOSO,
  ETIQUETA_HORA_AVISOS,
  ETIQUETA_HORARIO_SILENCIOSO,
  HORAS_AVISOS,
  HORAS_SILENCIO_DESDE,
  HORAS_SILENCIO_HASTA,
  opcionesHora,
  PISTA_ABRIR_AJUSTES_AVISOS,
  PISTA_PERMITIR_AVISOS,
  PREGUNTA_HORA_AVISOS,
  PREGUNTA_SILENCIO_DESDE,
  PREGUNTA_SILENCIO_HASTA,
  SECCION_AVISOS,
} from './avisos-textos';
import { MENSAJE_NO_GUARDAR } from './textos';

/**
 * Ajustes → Avisos (`02 §12`, `02 §13`): qué avisos salen (tarjetas, riesgo, respaldo, tandas, pagos e ingresos),
 * a qué hora y el horario silencioso. Las horas se eligen con chips de horas comunes (nada que teclear). Cada cambio
 * se guarda en servicios al tocarlo y la sincronización vuelve a programar los avisos del teléfono.
 */
export function SeccionAvisos() {
  const { ctx, refrescar } = useSesion();
  const notificaciones = useNotificaciones();
  const pref = useVista(obtenerPreferenciasAvisos);
  const [permiso, setPermiso] = useState<PermisoAvisos | null>(null);
  const [mensaje, setMensajeBase] = useState<string | null>(null);
  // VoiceOver no lee la región viva del mensaje: en iPhone se anuncia aparte.
  const setMensaje = (texto: string | null) => {
    setMensajeBase(texto);
    if (texto) anunciar(texto);
  };

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
      setMensaje(MENSAJE_NO_GUARDAR);
    }
  };

  return (
    <View testID="ajustes-avisos" style={{ gap: espacio.l }}>
      <Grupo titulo={SECCION_AVISOS} testIDTitulo="ajustes-avisos-titulo">
        {permiso !== null && permiso !== 'concedido' && notificaciones ? (
          <CeldaGrupo>
            <Texto
              variante="secundario"
              tono="secundario"
              testID="ajustes-avisos-sin-permiso"
              accessibilityRole="alert"
              accessibilityLabel={ETIQUETA_AVISOS_APAGADOS_TELEFONO}
            >
              {AVISOS_APAGADOS_EN_TELEFONO}
            </Texto>
            <Boton
              testID="ajustes-avisos-permitir"
              variante="secundario"
              etiqueta={permiso === 'sin_preguntar' ? BTN_PERMITIR_AVISOS : BTN_ABRIR_AJUSTES_TELEFONO}
              pista={permiso === 'sin_preguntar' ? PISTA_PERMITIR_AVISOS : PISTA_ABRIR_AJUSTES_AVISOS}
              alPresionar={() => {
                if (permiso === 'denegado') {
                  // Sin el atajo del puerto de avisos, los ajustes del sistema se abren directo: el botón nunca
                  // se queda sin hacer nada.
                  if (notificaciones.abrirAjustesSistema) notificaciones.abrirAjustesSistema();
                  else void Linking.openSettings().catch(() => undefined);
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
          </CeldaGrupo>
        ) : null}
        <FilaInterruptor
          testID="ajustes-aviso-corte"
          titulo={AVISO_CORTE}
          apoyo={DESC_CORTE}
          valor={pref.corte}
          alCambiar={(corte) => guardar({ corte })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-limite"
          titulo={AVISO_LIMITE}
          apoyo={DESC_LIMITE}
          valor={pref.fechaLimite}
          alCambiar={(fechaLimite) => guardar({ fechaLimite })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-riesgo"
          titulo={AVISO_RIESGO}
          apoyo={DESC_RIESGO}
          valor={pref.riesgo}
          alCambiar={(riesgo) => guardar({ riesgo })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-respaldo"
          titulo={AVISO_RESPALDO}
          apoyo={DESC_RESPALDO}
          valor={pref.respaldo}
          alCambiar={(respaldo) => guardar({ respaldo })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-tanda"
          titulo={AVISO_TANDA}
          apoyo={DESC_TANDA}
          valor={pref.tanda}
          alCambiar={(tanda) => guardar({ tanda })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-compromiso"
          titulo={AVISO_COMPROMISO}
          apoyo={DESC_COMPROMISO}
          valor={pref.compromiso}
          alCambiar={(compromiso) => guardar({ compromiso })}
        />
        <FilaInterruptor
          testID="ajustes-aviso-ingreso"
          titulo={AVISO_INGRESO}
          apoyo={DESC_INGRESO}
          valor={pref.ingreso}
          alCambiar={(ingreso) => guardar({ ingreso })}
        />
      </Grupo>
      <Grupo>
        <CeldaGrupo>
          <Texto variante="etiqueta" testID="ajustes-aviso-hora-titulo" {...OCULTAR_ETIQUETA_VISIBLE}>
            {ETIQUETA_HORA_AVISOS}
          </Texto>
          <GrupoChips
            prefijoTestID="ajustes-aviso-hora"
            etiqueta={PREGUNTA_HORA_AVISOS}
            opciones={opcionesHora(HORAS_AVISOS, pref.hora)}
            valor={pref.hora}
            alCambiar={(hora) => guardar({ hora }, CONFIRMACION_HORARIO)}
          />
        </CeldaGrupo>
        <CeldaGrupo>
          <Texto
            variante="etiqueta"
            testID="ajustes-avisos-horario-titulo"
            accessibilityRole="header"
            accessibilityLabel={ETIQUETA_BLOQUE_HORARIO_SILENCIOSO}
          >
            {ETIQUETA_HORARIO_SILENCIOSO}
          </Texto>
          <Texto
            variante="secundario"
            tono="secundario"
            testID="ajustes-avisos-horario-desc"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {DESC_HORARIO_SILENCIOSO}
          </Texto>
          <View style={{ gap: espacio.s }}>
            <Texto variante="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
              {PREGUNTA_SILENCIO_DESDE}
            </Texto>
            <GrupoChips
              prefijoTestID="ajustes-silencio-inicio"
              etiqueta={PREGUNTA_SILENCIO_DESDE}
              opciones={opcionesHora(HORAS_SILENCIO_DESDE, pref.silencio.inicio)}
              valor={pref.silencio.inicio}
              alCambiar={(inicio) =>
                guardar({ silencio: { inicio, fin: pref.silencio.fin } }, CONFIRMACION_HORARIO)
              }
            />
          </View>
          <View style={{ gap: espacio.s }}>
            <Texto variante="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
              {PREGUNTA_SILENCIO_HASTA}
            </Texto>
            <GrupoChips
              prefijoTestID="ajustes-silencio-fin"
              etiqueta={PREGUNTA_SILENCIO_HASTA}
              opciones={opcionesHora(HORAS_SILENCIO_HASTA, pref.silencio.fin)}
              valor={pref.silencio.fin}
              alCambiar={(fin) =>
                guardar({ silencio: { inicio: pref.silencio.inicio, fin } }, CONFIRMACION_HORARIO)
              }
            />
          </View>
        </CeldaGrupo>
      </Grupo>
      {mensaje ? (
        <Texto
          variante="secundario"
          tono={mensaje === MENSAJE_NO_GUARDAR ? 'faltante' : 'acento'}
          importantForAccessibility="yes"
          accessibilityLiveRegion="polite"
          accessibilityRole={mensaje === MENSAJE_NO_GUARDAR ? 'alert' : undefined}
          testID="ajustes-avisos-mensaje"
        >
          {mensaje}
        </Texto>
      ) : null}
    </View>
  );
}
