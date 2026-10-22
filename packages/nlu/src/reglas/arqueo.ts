/**
 * ARQUEO del nivel 0 (docs/06-NLU.md §9): cuánto efectivo trae la persona.
 *   ARQUEO := (traigo|tengo|me quedan|me queda) MONTO [pesos] (en|de) EFECTIVO
 *           | [ya] no (traigo|tengo) (nada|ni un peso) (de|en) EFECTIVO            → 0
 *   EFECTIVO := efectivo | cash | billetes | la cartera | mi cartera | el efectivo
 * "como"/"aprox" en el monto → `aproximado: true`.
 */
import type { Interpretacion } from '../esquema';
import { Lector } from './lector';
import { leerMonto } from './montos';
import type { Tokens } from './tokens';

const EFECTIVO: readonly (readonly string[])[] = [
  ['la', 'cartera'],
  ['mi', 'cartera'],
  ['el', 'efectivo'],
  ['efectivo'],
  ['cash'],
  ['billetes'],
];

export function arqueo(tokens: Tokens): Interpretacion | null {
  const l = new Lector(tokens);
  l.palabra('ya');
  if (l.palabra('no')) {
    if (!l.palabra('traigo', 'tengo')) return null;
    if (!l.alguna(['nada'], ['ni', 'un', 'peso'], ['ni', 'un', 'varo'])) return null;
    if (!l.palabra('de', 'en') || !l.alguna(...EFECTIVO) || !l.fin) return null;
    return { intencion: 'arqueo', efectivo_real: 0 };
  }
  if (!l.alguna(['traigo'], ['tengo'], ['me', 'quedan'], ['me', 'queda'])) return null;
  const lectura = leerMonto(l);
  if (!lectura) return null;
  if (!l.palabra('en', 'de') || !l.alguna(...EFECTIVO) || !l.fin) return null;
  return {
    intencion: 'arqueo',
    efectivo_real: lectura.monto,
    ...(lectura.aproximado ? { aproximado: true } : {}),
  };
}
