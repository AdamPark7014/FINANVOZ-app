import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { fijarPreferenciasAvisos, obtenerPreferenciasAvisos, type PreferenciasAvisos } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { useNotificaciones, type PermisoAvisos } from '../avisos/notificaciones';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "9:00" → "09:00"; lo demás se queda igual para que el servicio lo rechace con su mensaje. */
function normalizarHora(texto: string): string {
  const t = texto.trim();
  return /^\d:\d\d$/.test(t) ? `0${t}` : t;
}

/**
 * Ajustes → Avisos (`02 §12`, `02 §13`): qué avisos salen (tarjetas y riesgo de no llegar), a qué hora y el horario silencioso. Cada
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
      setMensaje('Escribe las horas así: 22:00.');
    }
  };

  const guardarHorario = () => {
    const h = normalizarHora(hora);
    const i = normalizarHora(inicio);
    const f = normalizarHora(fin);
    if (![h, i, f].every((x) => HORA.test(x))) {
      setMensaje('Escribe las horas así: 22:00.');
      return;
    }
    guardar({ hora: h, silencio: { inicio: i, fin: f } }, 'Listo. Tus avisos ya usan este horario.');
  };

  return (
    <Tarjeta testID="ajustes-avisos">
      <Texto variante="subtitulo">Avisos</Texto>
      {permiso !== null && permiso !== 'concedido' && notificaciones ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario" testID="ajustes-avisos-sin-permiso">
            Los avisos están apagados en tu teléfono.
          </Texto>
          <Boton
            testID="ajustes-avisos-permitir"
            variante="secundario"
            etiqueta={permiso === 'sin_preguntar' ? 'Permitir avisos' : 'Abrir ajustes del teléfono'}
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
        etiqueta="Día de corte"
        descripcion="El día que corta cada tarjeta."
        valor={pref.corte}
        alCambiar={(corte) => guardar({ corte })}
      />
      <Interruptor
        testID="ajustes-aviso-limite"
        etiqueta="Fecha límite de pago"
        descripcion="3 días antes, con lo que tienes que pagar para no generar intereses."
        valor={pref.fechaLimite}
        alCambiar={(fechaLimite) => guardar({ fechaLimite })}
      />
      <Interruptor
        testID="ajustes-aviso-riesgo"
        etiqueta="Riesgo de no llegar"
        descripcion="Si es más probable que tengas que tocar tu colchón antes de tu próximo ingreso."
        valor={pref.riesgo}
        alCambiar={(riesgo) => guardar({ riesgo })}
      />
      <Interruptor
        testID="ajustes-aviso-respaldo"
        etiqueta="Respaldo pendiente"
        descripcion="Si pasan 2 semanas sin respaldo, una vez por semana."
        valor={pref.respaldo}
        alCambiar={(respaldo) => guardar({ respaldo })}
      />
      <CampoTexto
        testID="ajustes-aviso-hora"
        etiqueta="Hora de los avisos"
        ejemplo="09:00"
        valor={hora}
        alCambiar={setHora}
        nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
      />
      <Texto variante="etiqueta">Horario silencioso</Texto>
      <Texto variante="secundario" tono="secundario">
        En este horario no te aviso nada; lo que caiga ahí sale cuando termina.
      </Texto>
      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        <View style={{ flex: 1 }}>
          <CampoTexto
            testID="ajustes-silencio-inicio"
            etiqueta="Desde"
            ejemplo="22:00"
            valor={inicio}
            alCambiar={setInicio}
            nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CampoTexto
            testID="ajustes-silencio-fin"
            etiqueta="Hasta"
            ejemplo="08:00"
            valor={fin}
            alCambiar={setFin}
            nativo={{ keyboardType: 'numbers-and-punctuation', maxLength: 5 }}
          />
        </View>
      </View>
      <Boton
        testID="ajustes-guardar-horario"
        variante="secundario"
        etiqueta="Guardar horario"
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
