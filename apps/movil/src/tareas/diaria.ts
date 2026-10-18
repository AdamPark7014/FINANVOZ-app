/**
 * Apertura del día en segundo plano (pendiente 63, `03 §5.3`, `03 §7`, tabla de `03`: `expo-background-task`).
 * Android la corre con WorkManager aunque nadie abra la app (después del primer desbloqueo: la llave de la base
 * está en el almacén seguro sin autenticación, `04 §7`). Corre los mismos procesos que al abrir Hoy
 * (`procesarApertura`: E14 suscripciones del día, ocurrencias, cortes) y vuelve a pintar el widget "Hoy puedes".
 * Todo es idempotente: correrla dos veces el mismo día o junto con la apertura en primer plano no duplica nada.
 *
 * Con la app en primer plano no hace nada: Hoy ya corre la apertura y así no se abre una segunda conexión a la
 * base mientras la primera escribe. Nada se registra en logs (regla 9).
 *
 * `defineTask` debe correr al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso este
 * módulo se importa desde `index.ts`, antes que Expo Router. Registrar o quitar la tarea: `programar.ts`.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import {
  obtenerConsentimiento,
  obtenerVistaWidget,
  onboardingCompletado,
  procesarApertura,
  type VistaWidget,
} from '../servicios';
import { abrirSesion, type Sesion } from '../servicios/sesion';
import { actualizarWidget } from '../widget/actualizar';
import { TAREA_DIARIA } from './programar';

/**
 * Abre la base, corre la apertura, arma la vista del widget y cierra la base antes de pintarlo. `false` si la
 * base no se pudo abrir (p. ej., antes del primer desbloqueo) o la apertura falló: el widget se queda como estaba
 * y su propia tarea muestra "Toca para ver tu día".
 */
export async function abrirDiaEnSegundoPlano(
  abrir: () => Sesion,
  repintar: (vista: VistaWidget) => Promise<void>,
  enPrimerPlano: () => boolean = () => AppState.currentState === 'active',
): Promise<boolean> {
  if (enPrimerPlano()) return true;
  let sesion: Sesion | null = null;
  let vista: VistaWidget;
  try {
    sesion = abrir();
    // Antes del consentimiento o del onboarding no se escribe nada (como el widget).
    if (obtenerConsentimiento(sesion.ctx) && onboardingCompletado(sesion.ctx)) procesarApertura(sesion.ctx);
    vista = obtenerVistaWidget(sesion.ctx);
  } catch {
    return false;
  } finally {
    try {
      sesion?.base.cerrar();
    } catch {
      // Ya estaba cerrada.
    }
  }
  await repintar(vista);
  return true;
}

TaskManager.defineTask(TAREA_DIARIA, async () => {
  try {
    return (await abrirDiaEnSegundoPlano(() => abrirSesion(), actualizarWidget))
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
