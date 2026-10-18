/**
 * Registra o quita la apertura del día en segundo plano (`diaria.ts` la define). Los módulos nativos se cargan
 * aquí al usarse: sin ellos (Expo Go, pruebas) no pasa nada y la apertura queda para cuando se abre Hoy.
 */
export const TAREA_DIARIA = 'finanvoz.dia.apertura';
/**
 * Minutos entre corridas (Android pide al menos 15; WorkManager decide el momento exacto). Más de una por día a
 * propósito: así la primera cae cerca del inicio del día; repetirla no duplica nada.
 */
export const INTERVALO_TAREA_DIARIA_MIN = 6 * 60;

type ModuloTareas = typeof import('expo-task-manager');
type ModuloSegundoPlano = typeof import('expo-background-task');

/** Idempotente: registra si `activo` y no está registrada; la quita si no. */
export async function programarTareaDiaria(activo: boolean): Promise<void> {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- carga perezosa de los módulos nativos */
    const TaskManager = require('expo-task-manager') as ModuloTareas;
    const BackgroundTask = require('expo-background-task') as ModuloSegundoPlano;
    /* eslint-enable @typescript-eslint/no-require-imports */
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA_DIARIA);
    if (activo && !registrada) {
      await BackgroundTask.registerTaskAsync(TAREA_DIARIA, { minimumInterval: INTERVALO_TAREA_DIARIA_MIN });
    } else if (!activo && registrada) {
      await BackgroundTask.unregisterTaskAsync(TAREA_DIARIA);
    }
  } catch {
    // Sin el módulo nativo o con las tareas restringidas por el sistema.
  }
}
