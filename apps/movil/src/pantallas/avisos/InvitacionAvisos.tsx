import { useEffect, useState } from 'react';
import { listarTarjetas } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Tarjeta, Texto } from '../../ui';
import { useNotificaciones, type PermisoAvisos } from './notificaciones';

/** "Ahora no" vale hasta cerrar la app: la invitación vuelve a salir la próxima vez, nunca dos veces seguidas. */
let descartadaEnSesion = false;

/** Solo para pruebas. */
export function reiniciarInvitacionAvisos() {
  descartadaEnSesion = false;
}

/**
 * Pide el permiso de avisos con amabilidad (`02 §1`): solo cuando ya hay una tarjeta y nunca se ha preguntado,
 * primero explica para qué es y el diálogo del sistema sale solo si la persona dice que sí.
 */
export function InvitacionAvisos() {
  const notificaciones = useNotificaciones();
  const { refrescar } = useSesion();
  const hayTarjetas = useVista((ctx) => listarTarjetas(ctx).length > 0);
  const [permiso, setPermiso] = useState<PermisoAvisos | null>(null);
  const [oculta, setOculta] = useState(descartadaEnSesion);

  useEffect(() => {
    if (!notificaciones || !hayTarjetas) return;
    let vigente = true;
    notificaciones
      .permiso()
      .then((p) => vigente && setPermiso(p))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [notificaciones, hayTarjetas]);

  if (!notificaciones || !hayTarjetas || oculta || permiso !== 'sin_preguntar') return null;
  return (
    <Tarjeta testID="invitacion-avisos">
      <Texto variante="cuerpoFuerte">¿Te aviso antes de que venzan tus tarjetas?</Texto>
      <Texto variante="secundario" tono="secundario">
        Te aviso el día de corte y 3 días antes de la fecha límite, con lo que tienes que pagar para no
        generar intereses. Los avisos se quedan en tu teléfono.
      </Texto>
      <Boton
        etiqueta="Sí, avísame"
        testID="invitacion-avisos-si"
        alPresionar={() => {
          setOculta(true);
          notificaciones
            .pedirPermiso()
            .then((p) => {
              setPermiso(p);
              // La sincronización corre al subir la versión.
              refrescar();
            })
            .catch(() => undefined);
        }}
      />
      <Boton
        etiqueta="Ahora no"
        variante="texto"
        testID="invitacion-avisos-no"
        alPresionar={() => {
          descartadaEnSesion = true;
          setOculta(true);
        }}
      />
    </Tarjeta>
  );
}
