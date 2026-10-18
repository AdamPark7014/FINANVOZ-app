/**
 * Registra o quita la tarea que procesa la cola de captura en segundo plano (`tarea.ts` la define). Los módulos
 * nativos se cargan aquí al usarse: sin ellos (Expo Go, pruebas) no pasa nada y la cola se procesa al abrir la app.
 */
export const TAREA_CAPTURA = 'finanvoz.captura.procesar';
/** Minutos entre corridas (Android pide al menos 15). */
export const INTERVALO_TAREA_MIN = 15;

type ModuloTareas = typeof import('expo-task-manager');
type ModuloSegundoPlano = typeof import('expo-background-task');

/** Idempotente: registra si `activo` (captura encendida) y no está registrada; la quita si no. */
export async function programarTareaCaptura(activo: boolean): Promise<void> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- carga perezosa de los módulos nativos */
    const TaskManager = require('expo-task-manager') as ModuloTareas;
    const BackgroundTask = require('expo-background-task') as ModuloSegundoPlano;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA_CAPTURA);
    if (activo && !registrada) {
      await BackgroundTask.registerTaskAsync(TAREA_CAPTURA, { minimumInterval: INTERVALO_TAREA_MIN });
    } else if (!activo && registrada) {
      await BackgroundTask.unregisterTaskAsync(TAREA_CAPTURA);
    }
  } catch {
    // Sin el módulo nativo o con las tareas restringidas por el sistema.
  }
}
