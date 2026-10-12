/**
 * `captura/ingesta` (`03 §5.2`, `07 §2.4`): de la cola nativa a capturas y movimientos. Calcula la huella de
 * cada notificación (asíncrono: SHA-256), aplica el mapeo de depuración por etiqueta de `adb` y registra cada
 * una en orden con los pasos de `07 §5`. Es idempotente: la misma notificación dos veces se registra una vez.
 *
 * Regla 9: no registra nada en logs; el texto solo llega a la base cifrada.
 */
import type { CatalogoPlantillas } from '@cartera/core';
import { procesarApertura } from '../servicios/apertura';
import type { Contexto } from '../servicios/contexto';
import { registrarCaptura, purgarTextosCaptura, type ResultadoCaptura } from '../servicios/capturas';
import { registrarSenalesCaptura } from '../servicios/estado-captura';
import { paqueteEfectivo } from './catalogo';
import { calcularHuella, cuandoEfectivo } from './huella';
import type { NotificacionCruda, PuenteCaptura, Sha256Hex } from './tipos';

export interface OpcionesIngesta {
  readonly catalogo: CatalogoPlantillas;
  readonly sha256: Sha256Hex;
  /** Solo builds de depuración: acepta `com.android.shell` con la etiqueta del banco (`07 §2.5`). */
  readonly depuracion: boolean;
}

/** Registra las notificaciones en el orden recibido. Repetirlas no crea nada nuevo (huella, CA-M5-10). */
export async function ingerirNotificaciones(
  ctx: Contexto,
  notificaciones: readonly NotificacionCruda[],
  opciones: OpcionesIngesta,
): Promise<ResultadoCaptura[]> {
  const conHuella = await Promise.all(
    notificaciones.map(async (n) => ({ n, huella: await calcularHuella(n, opciones.sha256) })),
  );
  // Ocurrencias materializadas y cortes cerrados antes de cubrir nada (E3.5 necesita las pendientes).
  if (conHuella.length > 0) procesarApertura(ctx);
  const resultados = conHuella.map(({ n, huella }) =>
    registrarCaptura(
      ctx,
      {
        huella,
        paquete: paqueteEfectivo(n, opciones.catalogo, opciones.depuracion),
        cuando: cuandoEfectivo(n),
        titulo: n.titulo,
        texto: n.texto,
      },
      opciones.catalogo,
    ),
  );
  if (notificaciones.length > 0) {
    const ultimo = Math.max(...notificaciones.map(cuandoEfectivo));
    registrarSenalesCaptura(ctx, { ultimoEvento: ultimo });
  }
  purgarTextosCaptura(ctx);
  return resultados;
}

export interface ResultadoCola {
  readonly leidas: number;
  /** Capturas nuevas (sin contar repetidas). */
  readonly nuevas: number;
  /** Movimientos nuevos para el aviso agrupado ("3 movimientos nuevos", `02 §6`). */
  readonly movimientos: number;
  readonly resultados: readonly ResultadoCaptura[];
}

/**
 * Procesa la cola nativa (al arrancar, al volver a la app y en la tarea en segundo plano) y la confirma solo
 * después de guardar: si algo falla antes, la próxima vez se vuelve a leer y la huella evita duplicados.
 */
export async function procesarColaCaptura(
  ctx: Contexto,
  puente: PuenteCaptura,
  opciones: OpcionesIngesta,
): Promise<ResultadoCola> {
  const cola = await puente.leerCola();
  const resultados = await ingerirNotificaciones(ctx, cola, opciones);
  if (cola.length > 0) await puente.confirmarProcesadas(cola);
  const nuevas = resultados.filter((r) => r.nueva);
  return {
    leidas: cola.length,
    nuevas: nuevas.length,
    movimientos: nuevas.filter((r) => r.estado === 'vinculada').length,
    resultados,
  };
}
