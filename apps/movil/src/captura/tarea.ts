/**
 * Procesamiento de la cola de captura en segundo plano (`07 §2.4`, pendiente 16). Android la corre con
 * WorkManager aunque la app esté cerrada (después del primer desbloqueo: la llave de la base está en el almacén
 * seguro sin autenticación, `04 §7`). Al terminar, aviso local agrupado sin montos ni comercios. Solo queda
 * registrada mientras la captura está activa (`programar.ts`). Nada se registra en logs (regla 9).
 *
 * `defineTask` debe correr al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso este
 * módulo se importa desde `index.ts`, antes que Expo Router.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import type { OpcionesIngesta } from './ingesta';
import { procesarColaCaptura } from './ingesta';
import {
  avisarCapturasNuevas,
  crearPublicadorCapturaExpo,
  liquidarAvisosCapturaPendientes,
  type PublicadorAvisoCaptura,
} from './aviso-capturas';
import { catalogoApp } from './catalogo';
import { puenteCaptura } from './puente';
import { sha256Expo } from './sha256Expo';
import type { PuenteCaptura } from './tipos';
import { abrirSesion, type Sesion } from '../servicios/sesion';
import { TAREA_CAPTURA } from './programar';

export interface DependenciasTareaCaptura {
  readonly puente: PuenteCaptura | null;
  readonly opciones: OpcionesIngesta;
  readonly publicador: PublicadorAvisoCaptura | null;
}

export function dependenciasTareaCaptura(): DependenciasTareaCaptura {
  const puente = puenteCaptura.disponible() ? puenteCaptura : null;
  return {
    puente,
    opciones: {
      catalogo: catalogoApp(),
      sha256: sha256Expo,
      depuracion: puente?.esDepuracion() ?? false,
    },
    publicador: crearPublicadorCapturaExpo(),
  };
}

/**
 * Lee la cola nativa, ingiere y avisa si hubo movimientos nuevos. `true` si no hubo falla irrecuperable (sin
 * puente no es falla: la captura no está disponible en ese build).
 */
export async function procesarCapturaEnSegundoPlano(
  abrir: () => Sesion,
  deps: () => DependenciasTareaCaptura,
): Promise<boolean> {
  const { puente, opciones, publicador } = deps();
  if (!puente) return true;
  let sesion: Sesion | null = null;
  try {
    sesion = abrir();
    const aviso = { enSegundoPlano: true, ahora: sesion.ctx.reloj.ahora() };
    await liquidarAvisosCapturaPendientes(sesion.ctx, publicador, aviso);
    const r = await procesarColaCaptura(sesion.ctx, puente, opciones);
    await avisarCapturasNuevas(sesion.ctx, r.movimientos, publicador, aviso);
    return true;
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

TaskManager.defineTask(TAREA_CAPTURA, async () => {
  try {
    return (await procesarCapturaEnSegundoPlano(() => abrirSesion(), dependenciasTareaCaptura))
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
