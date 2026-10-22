/**
 * Monto dictado en un campo (docs/06-NLU.md §9.4): lo que la persona dice cuando la app solo pregunta una cifra
 * ("¿Cuánto traes?", "¿Cuánto debes?", el monto de un formulario). Consume la frase completa o devuelve `null`:
 *
 *   MONTO_SUELTO := [PRELUDIO] (MONTO [con N centavos] | CERO)
 *   PRELUDIO     := son | es | fueron | fue | serían | da | me da | el arqueo da | conté | me salen | pon | ponle
 *                 | anota | quiero [guardar|tener] | guarda | guárdame | aparta | traigo | tengo | debo | le debo
 *                 | me pagan | gano | me prestan | me queda | me quedan | cuesta | me cuesta | me cobran
 *   CERO         := cero [pesos] | nada | ni un peso | ni un varo                     (solo con `admiteCero`)
 *                 | no traigo nada | no tengo nada | no debo nada                     (sin preludio)
 *
 * "como", "más o menos", "aproximadamente" (y las demás marcas de `MONTO`) → `aproximado: true`. Todo lo demás
 * ("más de", "menos de", "entre", "hasta", "o", dos cifras, "al mes", "cada", un "no" fuera de CERO) sobra y da
 * `null`. Nunca registra en logs el texto ni la cifra (regla 9).
 */
import { Lector } from './lector';
import { leerMonto } from './montos';
import { tokenizar, type Tokens } from './tokens';

export interface MontoDictado {
  centavos: number;
  aproximado: boolean;
}

/** Más largas primero: `Lector.alguna` se queda con la primera que coincide. */
const PRELUDIOS: readonly (readonly string[])[] = [
  ['el', 'arqueo', 'da'],
  ['quiero', 'guardar'],
  ['quiero', 'tener'],
  ['me', 'da'],
  ['me', 'salen'],
  ['me', 'pagan'],
  ['me', 'prestan'],
  ['me', 'quedan'],
  ['me', 'queda'],
  ['me', 'cuesta'],
  ['me', 'cobran'],
  ['le', 'debo'],
  ['fueron'],
  ['fue'],
  ['son'],
  ['es'],
  ['serian'],
  ['da'],
  ['conte'],
  ['ponle'],
  ['pon'],
  ['anota'],
  ['quiero'],
  ['guardame'],
  ['guarda'],
  ['aparta'],
  ['traigo'],
  ['tengo'],
  ['debo'],
  ['gano'],
  ['cuesta'],
];
const CERO_CON_PRELUDIO: readonly (readonly string[])[] = [
  ['ni', 'un', 'peso'],
  ['ni', 'un', 'varo'],
  ['cero', 'pesos'],
  ['cero'],
  ['nada'],
];
const CERO_SIN_PRELUDIO: readonly (readonly string[])[] = [
  ['no', 'traigo', 'nada'],
  ['no', 'tengo', 'nada'],
  ['no', 'debo', 'nada'],
];

/**
 * Cifra dictada en centavos. `admiteCero`: el campo acepta $0 (efectivo, colchón, saldo, deuda); si no, "cero",
 * "nada" o "0" dan `null`.
 */
export function interpretarMonto(texto: string, o: { admiteCero: boolean }): MontoDictado | null {
  return montoSuelto(tokenizar(texto), o);
}

/** `MONTO_SUELTO` sobre tokens ya cortados (lo usan también los lectores por paso). */
export function montoSuelto(tokens: Tokens, o: { admiteCero: boolean }): MontoDictado | null {
  if (tokens.t.length === 0) return null;
  const l = new Lector(tokens);
  if (o.admiteCero && l.alguna(...CERO_SIN_PRELUDIO))
    return l.fin ? { centavos: 0, aproximado: false } : null;
  l.volver(0);
  l.alguna(...PRELUDIOS);
  const despuesDelPreludio = l.marca();
  if (o.admiteCero && l.alguna(...CERO_CON_PRELUDIO))
    return l.fin ? { centavos: 0, aproximado: false } : null;
  l.volver(despuesDelPreludio);
  const lectura = leerMonto(l);
  if (!lectura || !l.fin) return null;
  if (lectura.monto === 0 && !o.admiteCero) return null;
  return { centavos: lectura.monto, aproximado: lectura.aproximado };
}
