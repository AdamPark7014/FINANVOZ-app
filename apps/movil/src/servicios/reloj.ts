import { esFecha, type PlainDate } from '@cartera/core';
import { ErrorDominio } from '@cartera/core';
import type { Reloj } from './contexto';

/**
 * Reloj del teléfono. Es la frontera con el sistema: aquí (y solo aquí) se lee `Date` para obtener la fecha
 * civil local del usuario; toda la lógica de negocio trabaja con `PlainDate`.
 */
export function relojDispositivo(): Reloj {
  return {
    hoy() {
      const d = new Date();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mes}-${dia}`;
    },
    ahora: () => Date.now(),
  };
}

/**
 * Reloj fijo (pruebas, semillas en builds de desarrollo). `ahora` avanza 1 ms por llamada para que
 * `registrada_en` conserve el orden.
 */
export function relojFijo(
  hoy: PlainDate,
  inicio = 1_790_000_000_000,
): Reloj & { fijar(fecha: PlainDate): void } {
  if (!esFecha(hoy)) throw new ErrorDominio('fecha_invalida', 'fecha inválida');
  let fecha = hoy;
  let instante = inicio;
  return {
    hoy: () => fecha,
    ahora: () => ++instante,
    fijar(nueva) {
      if (!esFecha(nueva)) throw new ErrorDominio('fecha_invalida', 'fecha inválida');
      fecha = nueva;
    },
  };
}
