/**
 * Avisos locales al capturar movimientos (`02 §6`, `07 §2.4`): texto sin montos ni comercios (regla 9). Solo
 * salen en segundo plano; con la app abierta basta el refresco de la interfaz.
 */
import {
  acumularAvisoCaptura,
  fijarAcumuloAvisoCaptura,
  obtenerModoAvisoCaptura,
  type ModoAvisoCaptura,
} from '../servicios/estado-captura';
import type { Contexto } from '../servicios/contexto';
import {
  PREFIJO_AVISO_CAPTURA,
  RUTA_AVISO_CAPTURA,
  TITULO_AVISO_CAPTURA,
  textoAvisoCaptura,
} from '../avisos/captura';

export {
  PREFIJO_AVISO_CAPTURA,
  RUTA_AVISO_CAPTURA,
  TITULO_AVISO_CAPTURA,
  textoAvisoCaptura,
} from '../avisos/captura';

/** Tope de frecuencia en modo agrupados (`02 §13`: agrupado cada 30 min). */
export const INTERVALO_AGRUPADO_MS = 30 * 60 * 1000;

export interface PublicadorAvisoCaptura {
  mostrar(cuerpo: string): Promise<void>;
}

/** Para pruebas y builds sin `expo-notifications`. */
export function publicadorEnMemoria(): PublicadorAvisoCaptura & { readonly cuerpos: () => readonly string[] } {
  const lista: string[] = [];
  return {
    cuerpos: () => [...lista],
    mostrar: async (cuerpo) => {
      if (cuerpo) lista.push(cuerpo);
    },
  };
}

/** Notificación inmediata con `expo-notifications`; `null` si el módulo no está. */
export function crearPublicadorCapturaExpo(): PublicadorAvisoCaptura | null {
  type ModuloExpo = typeof import('expo-notifications');
  let N: ModuloExpo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa del módulo nativo
    N = require('expo-notifications') as ModuloExpo;
  } catch {
    return null;
  }
  let secuencia = 0;
  return {
    mostrar: async (cuerpo) => {
      if (!cuerpo) return;
      secuencia += 1;
      await N.scheduleNotificationAsync({
        identifier: `${PREFIJO_AVISO_CAPTURA}${Date.now()}:${secuencia}`,
        content: {
          title: TITULO_AVISO_CAPTURA,
          body: cuerpo,
          data: { ruta: RUTA_AVISO_CAPTURA },
          sound: false,
        },
        trigger: null,
      });
    },
  };
}

export interface OpcionesAvisoCaptura {
  /** Con la app en primer plano no se avisa: la persona ya ve la pantalla. */
  readonly enSegundoPlano: boolean;
  readonly ahora?: number;
}

function debePublicarAgrupado(ultimoAviso: number | null, ahora: number): boolean {
  return ultimoAviso === null || ahora - ultimoAviso >= INTERVALO_AGRUPADO_MS;
}

async function publicar(
  publicador: PublicadorAvisoCaptura,
  cantidad: number,
  modo: ModoAvisoCaptura,
): Promise<void> {
  if (modo === 'cada_uno') {
    for (let i = 0; i < cantidad; i += 1) {
      await publicador.mostrar(textoAvisoCaptura(1));
    }
    return;
  }
  const cuerpo = textoAvisoCaptura(cantidad);
  if (cuerpo) await publicador.mostrar(cuerpo);
}

/**
 * Publica avisos tras procesar la cola en segundo plano. Modo agrupados: acumula y respeta 30 min entre avisos;
 * al vencer la ventana, el acumulado sale en la siguiente corrida (`liquidarAvisosCapturaPendientes`).
 */
export async function avisarCapturasNuevas(
  ctx: Contexto,
  movimientos: number,
  publicador: PublicadorAvisoCaptura | null,
  opciones: OpcionesAvisoCaptura,
): Promise<void> {
  if (movimientos <= 0 || !opciones.enSegundoPlano || !publicador) return;
  const modo = obtenerModoAvisoCaptura(ctx);
  if (modo === 'nunca') return;
  const ahora = opciones.ahora ?? ctx.reloj.ahora();

  if (modo === 'cada_uno') {
    await publicar(publicador, movimientos, modo);
    return;
  }

  const acumulado = acumularAvisoCaptura(ctx, movimientos);
  if (!debePublicarAgrupado(acumulado.ultimoAviso, ahora)) return;
  if (acumulado.pendiente <= 0) return;
  await publicar(publicador, acumulado.pendiente, modo);
  fijarAcumuloAvisoCaptura(ctx, { pendiente: 0, ultimoAviso: ahora });
}

/** Si quedó acumulado y ya pasó la ventana, publica un aviso agrupado (p. ej. al arrancar la tarea). */
export async function liquidarAvisosCapturaPendientes(
  ctx: Contexto,
  publicador: PublicadorAvisoCaptura | null,
  opciones: OpcionesAvisoCaptura,
): Promise<void> {
  if (!opciones.enSegundoPlano || !publicador) return;
  if (obtenerModoAvisoCaptura(ctx) !== 'agrupados') return;
  const ahora = opciones.ahora ?? ctx.reloj.ahora();
  const { pendiente, ultimoAviso } = acumularAvisoCaptura(ctx, 0);
  if (pendiente <= 0 || !debePublicarAgrupado(ultimoAviso, ahora)) return;
  await publicar(publicador, pendiente, 'agrupados');
  fijarAcumuloAvisoCaptura(ctx, { pendiente: 0, ultimoAviso: ahora });
}
