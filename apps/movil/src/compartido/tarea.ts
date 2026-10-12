/**
 * Sincronización de los gastos compartidos en segundo plano (M16, `03 §6`, tabla de `03`: `expo-background-task`).
 * Android la corre con WorkManager aunque la app esté cerrada (después del primer desbloqueo: la llave de la base
 * y las de los grupos están en el almacén seguro sin autenticación, `04 §7`). Publica lo pendiente y descarga lo
 * nuevo de cada grupo abierto con las mismas reglas que en primer plano (`sincronizarGruposAbiertos`). Solo queda
 * registrada mientras hay un grupo abierto (`programar.ts`). Nada se registra en logs (regla 9).
 *
 * `defineTask` debe correr al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso este
 * módulo se importa desde `index.ts`, antes que Expo Router.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { sincronizarGruposAbiertos, type DependenciasCompartido } from '../servicios';
import { abrirSesion, type Sesion } from '../servicios/sesion';
import { dependenciasCompartidoExpo } from './expo';
import { TAREA_COMPARTIDO } from './programar';

/**
 * Abre la base, sincroniza y la cierra. `true` si no hubo nada que reportar al sistema como falla: sin red o sin
 * servicio no es una falla (lo pendiente sigue guardado y se intenta en la siguiente corrida).
 */
export async function sincronizarEnSegundoPlano(
  abrir: () => Sesion,
  deps: () => DependenciasCompartido,
): Promise<boolean> {
  let sesion: Sesion | null = null;
  try {
    sesion = abrir();
    const r = await sincronizarGruposAbiertos(sesion.ctx, deps());
    return r.errores.every((e) => e === 'sin_red' || e === 'sin_servicio');
  } catch {
    return false;
  } finally {
    try {
      sesion?.base.cerrar();
    } catch {
      // Ya estaba cerrada.
    }
  }
}

TaskManager.defineTask(TAREA_COMPARTIDO, async () => {
  try {
    return (await sincronizarEnSegundoPlano(() => abrirSesion(), dependenciasCompartidoExpo))
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
