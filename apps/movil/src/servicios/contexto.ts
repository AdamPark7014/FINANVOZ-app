import type { PlainDate } from '@cartera/core';
import { Libro, type BaseDatos } from '@cartera/datos';

/**
 * Reloj inyectado. `hoy()` es la fecha civil del usuario (regla 6) y `ahora()` el instante en ms UTC para
 * `registrada_en` y evidencias. En pruebas y semillas se fija; en la app sale de `relojDispositivo()`.
 */
export interface Reloj {
  hoy(): PlainDate;
  ahora(): number;
  /**
   * Fecha civil del usuario para un instante en ms UTC (`cuando` de una notificación, M5). Opcional para no
   * romper relojes armados a mano; sin ella la captura usa `hoy()`.
   */
  fechaDe?(instante: number): PlainDate;
}

/** Todo lo que necesita un caso de uso: base síncrona, libro, reloj y generador de ids. */
export interface Contexto {
  readonly db: BaseDatos;
  readonly libro: Libro;
  readonly reloj: Reloj;
  /** UUIDv7 en la app (`04 §1`); ids deterministas en pruebas. */
  readonly generarId: () => string;
}

export function crearContexto(opciones: { db: BaseDatos; reloj: Reloj; generarId: () => string }): Contexto {
  const { db, reloj, generarId } = opciones;
  return {
    db,
    reloj,
    generarId,
    libro: new Libro(db, { generarId, ahora: () => reloj.ahora() }),
  };
}

/** Corre `fn` en una transacción SQLite (savepoint si ya hay una abierta). */
export function enTransaccion<T>(ctx: Contexto, fn: () => T): T {
  return ctx.db.transaction(() => fn());
}
