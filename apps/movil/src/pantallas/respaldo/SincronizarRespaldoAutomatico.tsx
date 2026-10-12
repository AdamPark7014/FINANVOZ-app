import { useEffect } from 'react';
import { obtenerRespaldoNube } from '../../servicios';
import { useControlApp } from '../../sesion/ControlApp';
import { useVista } from '../../sesion/ProveedorSesion';

/**
 * Deja registrada la tarea semanal del respaldo automático solo mientras está encendido (y hay nube): al abrir
 * la app, tras restaurar un respaldo que lo traía encendido y al cambiar el interruptor.
 */
export function SincronizarRespaldoAutomatico() {
  const respaldo = useControlApp().respaldo;
  const automatico = useVista((ctx) => {
    try {
      return obtenerRespaldoNube(ctx).automatico;
    } catch {
      return false;
    }
  });
  const programar = respaldo?.programarAutomatico;
  const conNube = Boolean(respaldo?.nube);
  useEffect(() => {
    void programar?.(automatico && conNube);
  }, [programar, automatico, conNube]);
  return null;
}
