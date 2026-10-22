/**
 * Registra o quita la apertura del día en segundo plano (`diaria.ts` la define). Los módulos nativos se cargan
 * aquí al usarse: sin ellos (Expo Go, pruebas) no pasa nada y la apertura queda para cuando se abre Hoy.
 *
 * iOS: `registerTaskAsync` usa `BGTaskScheduler`, que exige en el Info.plist `UIBackgroundModes: ["processing"]` y
 * el identificador `com.expo.modules.backgroundtask.processing` en `BGTaskSchedulerPermittedIdentifiers`. Los pone
 * el config plugin `expo-background-task` (en `app.json › plugins`); sin él, el registro falla en el iPhone y la
 * apertura solo corre al abrir la app. El fallo ya no se traga en silencio: se reporta a Sentry con un código fijo
 * (sin datos; los `console.*` están prohibidos en la app y Sentry descarta sus migas).
 */
export const TAREA_DIARIA = 'finanvoz.dia.apertura';
/**
 * Minutos entre corridas (Android pide al menos 15; WorkManager decide el momento exacto). Más de una por día a
 * propósito: así la primera cae cerca del inicio del día; repetirla no duplica nada.
 */
export const INTERVALO_TAREA_DIARIA_MIN = 6 * 60;

type ModuloTareas = typeof import('expo-task-manager');
type ModuloSegundoPlano = typeof import('expo-background-task');

/** Código fijo del reporte (`snake_case`, lo único que deja pasar la depuración de Sentry). */
export const CODIGO_FALLO_TAREA_DIARIA = 'tarea_diaria_sin_registrar';

/**
 * Reporta el fallo con un código fijo y la acción: nunca el mensaje del error ni datos del libro (regla 9). Sin DSN
 * (o en pruebas) Sentry no está iniciado y esto no hace nada. El sistema operativo ya viaja en el contexto del evento.
 */
function reportarFallo(accion: 'registrar' | 'quitar'): void {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa del SDK */
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.captureMessage(CODIGO_FALLO_TAREA_DIARIA, { level: 'warning', tags: { resultado: accion } });
  } catch {
    // Sin el SDK no hay a dónde reportarlo.
  }
}

/** Idempotente: registra si `activo` y no está registrada; la quita si no. */
export async function programarTareaDiaria(activo: boolean): Promise<void> {
  let TaskManager: ModuloTareas;
  let BackgroundTask: ModuloSegundoPlano;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- carga perezosa de los módulos nativos */
    TaskManager = require('expo-task-manager') as ModuloTareas;
    BackgroundTask = require('expo-background-task') as ModuloSegundoPlano;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    // Sin los módulos nativos (Expo Go): no hay nada que registrar.
    return;
  }
  try {
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREA_DIARIA);
    if (activo && !registrada) {
      await BackgroundTask.registerTaskAsync(TAREA_DIARIA, { minimumInterval: INTERVALO_TAREA_DIARIA_MIN });
    } else if (!activo && registrada) {
      await BackgroundTask.unregisterTaskAsync(TAREA_DIARIA);
    }
  } catch {
    // Tareas restringidas por el sistema o, en iPhone, el Info.plist sin `BGTaskSchedulerPermittedIdentifiers`.
    reportarFallo(activo ? 'registrar' : 'quitar');
  }
}
