import { esFecha, type PlainDate } from '@cartera/core';
import { ErrorDominio } from '@cartera/core';
import type { Reloj } from './contexto';

/**
 * Reloj del teléfono. Es la frontera con el sistema: aquí (y solo aquí) se lee `Date` para obtener la fecha
 * civil local del usuario; toda la lógica de negocio trabaja con `PlainDate`.
 */
export function relojDispositivo(): Reloj {
  const fechaLocal = (d: Date): PlainDate => {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  };
  return {
    hoy: () => fechaLocal(new Date()),
    ahora: () => Date.now(),
    fechaDe: (instante) => fechaLocal(new Date(instante)),
  };
}

/** Desfase de la Ciudad de México (UTC−6, sin horario de verano desde 2022), en minutos. */
export const DESFASE_CDMX_MIN = -360;

/** Fecha civil de un instante con un desfase fijo respecto de UTC (pruebas y semillas). */
export function fechaConDesfase(instante: number, desfaseMin: number): PlainDate {
  const d = new Date(instante + desfaseMin * 60_000);
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
}

/**
 * Reloj fijo (pruebas, semillas en builds de desarrollo). `ahora` avanza 1 ms por llamada para que
 * `registrada_en` conserve el orden.
 */
export function relojFijo(
  hoy: PlainDate,
  inicio = 1_790_000_000_000,
  desfaseMin = DESFASE_CDMX_MIN,
): Reloj & { fijar(fecha: PlainDate): void; fijarInstante(ms: number): void } {
  if (!esFecha(hoy)) throw new ErrorDominio('fecha_invalida', 'fecha inválida');
  let fecha = hoy;
  let instante = inicio;
  return {
    hoy: () => fecha,
    ahora: () => ++instante,
    fechaDe: (ms) => fechaConDesfase(ms, desfaseMin),
    fijarInstante(ms) {
      if (!Number.isSafeInteger(ms)) throw new ErrorDominio('instante_invalido', 'instante inválido');
      instante = ms;
    },
    fijar(nueva) {
      if (!esFecha(nueva)) throw new ErrorDominio('fecha_invalida', 'fecha inválida');
      fecha = nueva;
    },
  };
}
