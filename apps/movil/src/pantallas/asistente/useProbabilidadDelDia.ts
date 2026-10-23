import { useEffect, useState } from 'react';
import {
  horaDispositivo,
  leerProbabilidadHoy,
  obtenerProbabilidadHoy,
  sincronizarAvisoRiesgo,
  type OpcionesBloques,
  type VistaProbabilidadHoy,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { useNotificaciones } from '../avisos/notificaciones';

/**
 * La probabilidad de hoy (Plus) en segundo plano, aunque el desglose esté cerrado: con ella el asistente dice el
 * aviso de riesgo como turno y se replanea el aviso local (1 por horizonte). Si ya está calculada para este libro
 * se lee al instante; si no, se calcula por bloques y se cancela al salir o al cambiar el libro. Nunca bloquea.
 */
export function useProbabilidadDelDia(
  activa: boolean,
  bloques?: Omit<OpcionesBloques, 'senal'>,
  hora: () => string = horaDispositivo,
): VistaProbabilidadHoy | null {
  const { ctx, version } = useSesion();
  const notificaciones = useNotificaciones();
  const leida = useVista((c) => (activa ? leerProbabilidadHoy(c) : null));
  const [calculada, setCalculada] = useState<{ version: number; vista: VistaProbabilidadHoy } | null>(null);

  useEffect(() => {
    if (!activa || leida) return;
    const senal = { aborted: false };
    obtenerProbabilidadHoy(ctx, { ...bloques, senal })
      .then((vista) => {
        if (!senal.aborted) setCalculada({ version, vista });
      })
      // Cancelado o fallido: el asistente sigue sin probabilidad (sin detalle en logs, regla 9).
      .catch(() => undefined);
    return () => {
      senal.aborted = true;
    };
    // `bloques` solo se inyecta en pruebas; no reinicia el cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, version, leida, activa]);

  const vista = activa ? (leida ?? (calculada?.version === version ? calculada.vista : null)) : null;
  const lista = vista !== null;

  useEffect(() => {
    if (!lista || !notificaciones) return;
    let vigente = true;
    notificaciones
      .permiso()
      .then((p) =>
        vigente && p === 'concedido' ? sincronizarAvisoRiesgo(ctx, notificaciones.puerto, hora()) : null,
      )
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [ctx, version, lista, notificaciones, hora]);

  return vista;
}
