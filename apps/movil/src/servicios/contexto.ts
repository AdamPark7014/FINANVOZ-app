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
  /**
   * Catálogo semilla de suscripciones para E14 (M10). Por omisión, el de `07 §6`; las pruebas de CA-M10-01 fijan
   * el del vector E14-01 (vacío).
   */
  readonly catalogoSuscripciones?: readonly string[];
  /**
   * Contenido de `config/fiscal/<año>.json` por ejercicio (M12). Por omisión, los archivos del repositorio
   * (`servicios/config-fiscal.ts`); las pruebas de CA-M12-03 fijan uno armado con los parámetros sintéticos de
   * los vectores (`E13.config_prueba`). Siempre pasa por `validarConfigFiscal`.
   */
  readonly configFiscal?: Readonly<Record<number, unknown>>;
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
