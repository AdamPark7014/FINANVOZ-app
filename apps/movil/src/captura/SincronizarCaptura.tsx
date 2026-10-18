import { useEffect } from 'react';
import { useCaptura } from './ProveedorCaptura';
import { programarTareaCaptura } from './programar';
import { useVista } from '../sesion/ProveedorSesion';
import { obtenerEstadoCaptura } from '../servicios';

/**
 * Deja registrada la tarea de captura en segundo plano solo mientras la captura está activa y el módulo nativo
 * existe (pendiente 16).
 */
export function SincronizarCaptura() {
  const { puente } = useCaptura();
  const activada = useVista((ctx) => obtenerEstadoCaptura(ctx).activada);
  const conPuente = puente !== null;
  useEffect(() => {
    void programarTareaCaptura(activada && conPuente);
  }, [activada, conPuente]);
  return null;
}
