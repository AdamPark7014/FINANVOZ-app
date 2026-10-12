/**
 * Respaldo automático semanal en segundo plano (M9, `02 §19`, tabla de `03`: `expo-background-task`). Android lo
 * corre con WorkManager aunque la app esté cerrada o el teléfono bloqueado (después del primer desbloqueo: la
 * llave de la base y la del respaldo están en el almacén seguro sin autenticación, `04 §7`). La tarea pasa cada
 * ~12 h; la lógica (`ejecutarRespaldoAutomatico`) decide si ya toca (7 días), si hay Wi-Fi y si la sesión de
 * correo sigue viva. Después replanea el aviso de 14 días. Nada se registra (regla 9).
 *
 * `defineTask` debe correr al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso este
 * módulo se importa desde `index.ts`, antes que Expo Router. Registrar o quitar la tarea: `programar.ts`.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { tipoRedExpo } from '../nube/conectividad';
import { crearNubeRespaldoExpo } from '../nube/expo';
import { crearNotificacionesExpo } from '../pantallas/avisos/expo';
import { ejecutarRespaldoAutomatico, horaDispositivo, sincronizarAvisoRespaldo } from '../servicios';
import { abrirSesion } from '../servicios/sesion';
import { dependenciasRespaldoExpo } from './expo';
import { TAREA_RESPALDO } from './programar';

async function correr(): Promise<boolean> {
  const nube = crearNubeRespaldoExpo();
  if (!nube) return true;
  const sesion = abrirSesion();
  try {
    const r = await ejecutarRespaldoAutomatico(
      { cifrado: dependenciasRespaldoExpo, respaldos: nube.respaldos, red: tipoRedExpo },
      sesion.ctx,
    );
    const notificaciones = crearNotificacionesExpo();
    if (notificaciones && (await notificaciones.permiso()) === 'concedido') {
      await sincronizarAvisoRespaldo(sesion.ctx, notificaciones.puerto, horaDispositivo());
    }
    return r.tipo !== 'error';
  } finally {
    sesion.base.cerrar();
  }
}

TaskManager.defineTask(TAREA_RESPALDO, async () => {
  try {
    return (await correr())
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
