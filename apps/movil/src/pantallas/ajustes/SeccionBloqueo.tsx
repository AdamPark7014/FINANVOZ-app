import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { fijarBloqueo, obtenerBloqueo } from '../../servicios';
import { autenticadorExpo, comprobarParaActivar, type Autenticador } from '../../seguridad';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import {
  BTN_ABRIR_AJUSTES_SISTEMA,
  confirmacionBloqueoActivo,
  DESC_BLOQUEO,
  descMultitarea,
  ETIQUETA_MULTITAREA,
  etiquetaBloqueo,
  mensajeBloqueoApagadoSinSeguridad,
  mensajeBloqueoSinSeguridad,
  MENSAJE_BLOQUEO_DEMASIADOS,
  MENSAJE_BLOQUEO_NO_VERIFICADO,
  MENSAJE_NO_GUARDAR,
  pistaAbrirAjustesSistema,
  SECCION_BLOQUEO,
} from './textos';

type Mensaje = { texto: string; error: boolean; abrirAjustes: boolean };

/**
 * Ajustes › Bloqueo (RF-CFG-03, CA-M2-11). Encender el bloqueo exige que el teléfono tenga biometría o código y un
 * desbloqueo con éxito; si no, el bloqueo queda apagado y se explica por qué (un iPhone sin código nunca autentica:
 * encenderlo así dejaba la cortina puesta para siempre). Al abrir Ajustes, si el bloqueo está encendido pero el
 * teléfono ya no tiene código, se apaga y se avisa.
 */
export function SeccionBloqueo({ autenticador = autenticadorExpo }: { autenticador?: Autenticador }) {
  const { ctx, refrescar } = useSesion();
  const bloqueo = useVista(obtenerBloqueo);
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensajeBase] = useState<Mensaje | null>(null);
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const avisar = (m: Mensaje | null) => {
    if (!montado.current) return;
    setMensajeBase(m);
    // VoiceOver no lee la región viva: en iPhone se anuncia aparte.
    if (m) anunciar(m.texto);
  };

  const guardar = (cambios: Parameters<typeof fijarBloqueo>[1]): boolean => {
    try {
      fijarBloqueo(ctx, cambios);
      refrescar();
      return true;
    } catch {
      avisar({ texto: MENSAJE_NO_GUARDAR, error: true, abrirAjustes: false });
      return false;
    }
  };

  // El bloqueo quedó encendido de antes y el teléfono ya no tiene biometría ni código: se apaga y se explica.
  const activoAlAbrir = useRef(bloqueo.activo);
  useEffect(() => {
    if (!activoAlAbrir.current) return;
    let vigente = true;
    autenticador
      .disponible()
      .then((hay) => {
        if (!vigente || hay) return;
        if (guardar({ activo: false })) {
          avisar({ texto: mensajeBloqueoApagadoSinSeguridad(), error: true, abrirAjustes: true });
        }
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticador]);

  const cambiarBloqueo = async (activo: boolean) => {
    avisar(null);
    if (!activo) {
      guardar({ activo: false });
      return;
    }
    setVerificando(true);
    try {
      const r = await comprobarParaActivar(autenticador);
      if (r.activado) {
        if (guardar({ activo: true })) {
          avisar({ texto: confirmacionBloqueoActivo(), error: false, abrirAjustes: false });
        }
        return;
      }
      if (r.motivo === 'sin_seguridad') {
        guardar({ activo: false });
        avisar({ texto: mensajeBloqueoSinSeguridad(), error: true, abrirAjustes: true });
        return;
      }
      avisar({
        texto:
          r.motivo === 'demasiados_intentos' ? MENSAJE_BLOQUEO_DEMASIADOS : MENSAJE_BLOQUEO_NO_VERIFICADO,
        error: true,
        abrirAjustes: false,
      });
    } finally {
      if (montado.current) setVerificando(false);
    }
  };

  return (
    <Tarjeta testID="ajustes-seccion-bloqueo" style={{ gap: espacio.m }}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {SECCION_BLOQUEO}
      </Texto>
      <Interruptor
        testID="ajustes-bloqueo"
        etiqueta={etiquetaBloqueo()}
        descripcion={DESC_BLOQUEO}
        valor={bloqueo.activo}
        deshabilitado={verificando}
        alCambiar={(activo) => void cambiarBloqueo(activo)}
      />
      <Interruptor
        testID="ajustes-multitarea"
        etiqueta={ETIQUETA_MULTITAREA}
        descripcion={descMultitarea()}
        valor={bloqueo.ocultarEnMultitarea}
        alCambiar={(ocultarEnMultitarea) => {
          avisar(null);
          guardar({ ocultarEnMultitarea });
        }}
      />
      {mensaje ? (
        <>
          <Texto
            variante="secundario"
            tono={mensaje.error ? 'faltante' : 'acento'}
            accessibilityRole={mensaje.error ? 'alert' : 'text'}
            accessibilityLiveRegion="polite"
            importantForAccessibility="yes"
            testID="ajustes-bloqueo-mensaje"
          >
            {mensaje.texto}
          </Texto>
          {mensaje.abrirAjustes ? (
            <Boton
              testID="ajustes-bloqueo-abrir-ajustes"
              variante="secundario"
              ancho="contenido"
              etiqueta={BTN_ABRIR_AJUSTES_SISTEMA}
              pista={pistaAbrirAjustesSistema()}
              alPresionar={() => void Linking.openSettings().catch(() => undefined)}
            />
          ) : null}
        </>
      ) : null}
    </Tarjeta>
  );
}
