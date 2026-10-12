/**
 * Registra o quita la tarea que sincroniza los gastos compartidos en segundo plano (`tarea.ts` la define). Los
 * módulos nativos se cargan aquí al usarse: sin ellos (Expo Go, pruebas) no pasa nada y la sincronización queda
 * al abrir las pantallas y al volver la red.
 */
export const TAREA_COMPARTIDO = 'finanvoz.compartido.sincronizar';
/** Minutos entre corridas (Android pide al menos 15; WorkManager decide el momento exacto). */
export const INTERVALO_TAREA_MIN = 60;

type ModuloTareas = typeof import('expo-task-manager');
type ModuloSegundoPlano = typeof import('expo-background-task');

/** Idempotente: registra si `activo` (hay al menos un grupo abierto) y no está registrada; la quita si no. */
export async function programarSincronizacionCompartido(activo: boolean): Promise<void> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- carga perezosa de los módulos nativos */
    const TaskManager = require('expo-task-manager') as ModuloTareas;
    const BackgroundTask = require('expo-background-task') as ModuloSegundoPlano;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA_COMPARTIDO);
    if (activo && !registrada) {
      await BackgroundTask.registerTaskAsync(TAREA_COMPARTIDO, { minimumInterval: INTERVALO_TAREA_MIN });
    } else if (!activo && registrada) {
      await BackgroundTask.unregisterTaskAsync(TAREA_COMPARTIDO);
    }
  } catch {
    // Sin el módulo nativo o con las tareas restringidas por el sistema.
  }
}
