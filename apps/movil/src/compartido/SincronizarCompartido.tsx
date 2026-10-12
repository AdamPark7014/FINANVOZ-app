import { useEffect } from 'react';
import {
  gruposAbiertos,
  sincronizarGruposAbiertos,
  type Conectividad,
  type DependenciasCompartido,
} from '../servicios';
import { useSesion, useVista } from '../sesion/ProveedorSesion';

/** Espera tras volver la red antes de sincronizar: la conexión suele ir y venir varias veces seguidas. */
export const ESPERA_SINCRONIZAR_MS = 2000;

/**
 * Junta los disparos seguidos en una sola corrida y nunca corre dos a la vez: si llega otro mientras corre, repite
 * una sola vez al terminar. Un error de `correr` no se registra (regla 9); lo intenta el siguiente disparo.
 */
export function crearAntirrebote(correr: () => Promise<unknown>, esperaMs: number) {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let corriendo = false;
  let otraVez = false;
  let detenido = false;
  const ejecutar = async (): Promise<void> => {
    if (detenido) return;
    if (corriendo) {
      otraVez = true;
      return;
    }
    corriendo = true;
    try {
      await correr();
    } catch {
      // Lo intenta el siguiente disparo.
    } finally {
      corriendo = false;
    }
    if (otraVez && !detenido) {
      otraVez = false;
      await ejecutar();
    }
  };
  return {
    disparar(): void {
      if (detenido) return;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        void ejecutar();
      }, esperaMs);
    },
    detener(): void {
      detenido = true;
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
    },
  };
}

/**
 * Gastos compartidos fuera de sus pantallas (M16, pendiente 145): deja registrada la tarea en segundo plano solo
 * mientras hay un grupo abierto (y la build trae el servicio) y, con la app abierta, sincroniza los grupos cada
 * vez que vuelve la red. Lo que se descarga ya quedó en la base; aquí solo se vuelven a leer las vistas.
 */
export function SincronizarCompartido({
  deps,
  conectividad,
  programar,
}: {
  deps: DependenciasCompartido;
  conectividad: Conectividad;
  programar: (activo: boolean) => Promise<void>;
}) {
  const { ctx, refrescar } = useSesion();
  const hayAbiertos = useVista((c) => {
    try {
      return gruposAbiertos(c).length > 0;
    } catch {
      return false;
    }
  });
  const conServicio = deps.cliente !== null;

  useEffect(() => {
    void programar(hayAbiertos && conServicio);
  }, [programar, hayAbiertos, conServicio]);

  useEffect(() => {
    if (!hayAbiertos || !conServicio) return;
    let vigente = true;
    const antirrebote = crearAntirrebote(async () => {
      const r = await sincronizarGruposAbiertos(ctx, deps);
      if (vigente && r.grupos > 0) refrescar();
    }, ESPERA_SINCRONIZAR_MS);
    const dejar = conectividad.alReconectar(() => antirrebote.disparar());
    return () => {
      vigente = false;
      dejar();
      antirrebote.detener();
    };
  }, [ctx, deps, conectividad, hayAbiertos, conServicio, refrescar]);

  return null;
}
