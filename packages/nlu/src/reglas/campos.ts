/**
 * Gramáticas de campo del nivel 0 (docs/06-NLU.md §9.4): lo que se dicta en un campo de un formulario, no una frase
 * libre. Viven fuera de `PRODUCCIONES` para no mover el golden set. Deterministas y sin red; ante la duda, `null`.
 */
import type { Centavos } from '@cartera/core';
import { Lector } from './lector';
import { leerMonto, type LecturaMonto } from './montos';
import { tokenizar } from './tokens';

/** Palabras con las que se suele empezar a dictar una cantidad: «son 300», «ponle 1500». */
const ARRANQUES: readonly (readonly string[])[] = [
  ['son'],
  ['es'],
  ['fue'],
  ['fueron'],
  ['de'],
  ['pon'],
  ['ponle'],
  ['tengo'],
  ['traigo'],
];

/** «2 mil 500», «mil 500»: salida frecuente del dictado; solo con un resto de 1 a 999 en dígitos. */
function milesConResto(l: Lector): LecturaMonto | null {
  const inicio = l.marca();
  let miles = 1;
  const primero = l.ver();
  if (primero !== undefined && /^\d{1,3}$/.test(primero) && l.ver(1) === 'mil') {
    miles = Number(primero);
    l.pos++;
  }
  if (!l.palabra('mil')) {
    l.volver(inicio);
    return null;
  }
  const resto = l.ver();
  if (resto === undefined || !/^\d{1,3}$/.test(resto) || Number(resto) === 0) {
    l.volver(inicio);
    return null;
  }
  l.pos++;
  l.palabra('pesos', 'peso', 'varos');
  return { monto: ((miles * 1000 + Number(resto)) * 100) as Centavos, aproximado: false };
}

/**
 * CAMPO_MONTO := [ARRANQUE] (MONTO | cero | nada). Debe consumir toda la frase.
 * «mil quinientos» → 150000, «1.5k» → 150000, «quinientos cincuenta pesos» → 55000, «como 500» → aproximado.
 */
export function interpretarMonto(texto: string): LecturaMonto | null {
  const l = new Lector(tokenizar(texto));
  if (l.fin) return null;
  l.alguna(...ARRANQUES);
  if (l.palabra('cero', 'nada', '0')) {
    l.palabra('pesos');
    return l.fin ? { monto: 0 as Centavos, aproximado: false } : null;
  }
  const inicio = l.marca();
  const conResto = milesConResto(l);
  if (conResto && l.fin) return conResto;
  l.volver(inicio);
  const lectura = leerMonto(l);
  return lectura && l.fin ? lectura : null;
}
