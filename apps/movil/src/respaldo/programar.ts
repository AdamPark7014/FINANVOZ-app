/**
 * Registra o quita la tarea semanal del respaldo automático (`tarea.ts` la define). Los módulos nativos se cargan
 * aquí al usarse: sin ellos (Expo Go, pruebas) no pasa nada y queda "Respaldar ahora".
 */
export const TAREA_RESPALDO = 'finanvoz.respaldo.semanal';
/** Minutos entre corridas (Android pide al menos 15; la tarea misma espera a que pasen 7 días). */
export const INTERVALO_TAREA_MIN = 12 * 60;

type ModuloTareas = typeof import('expo-task-manager');
type ModuloSegundoPlano = typeof import('expo-background-task');

/** Idempotente: registra si `activo` y no está registrada; la quita si no. */
export async function programarRespaldoAutomatico(activo: boolean): Promise<void> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- carga perezosa de los módulos nativos */
    const TaskManager = require('expo-task-manager') as ModuloTareas;
    const BackgroundTask = require('expo-background-task') as ModuloSegundoPlano;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA_RESPALDO);
    if (activo && !registrada) {
      await BackgroundTask.registerTaskAsync(TAREA_RESPALDO, { minimumInterval: INTERVALO_TAREA_MIN });
    } else if (!activo && registrada) {
      await BackgroundTask.unregisterTaskAsync(TAREA_RESPALDO);
    }
  } catch {
    // Sin el módulo nativo o con las tareas restringidas por el sistema.
  }
}
