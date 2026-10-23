/**
 * Producciones del nivel 0 que antes iban a la nube solo para que la nube preguntara o dijera que no (docs/06-NLU.md
 * §9.2, regla de costo del 23-10-2026). No registran nada: fuera de alcance claro, la pregunta abierta «¿por qué…?»
 * (modo explicar) y las aclaraciones obvias (gasto sin cifra, sueldo bruto, «la semana pasada» sin día, «¿me
 * alcanza?» sin precio). Responden lo mismo que el nivel 2 en el golden set; si dudan, `null` (la nube decide).
 */
import type { Interpretacion } from '../esquema';
import { SEP, type Tokens } from './tokens';

/** Palabras que ya son una cifra (o parte de una): con alguna, la frase no es «sin monto». */
const PALABRAS_NUMERO = new Set([
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
  'cien',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
  'mil',
  'millon',
  'millones',
  'luca',
  'lucas',
  'kilo',
  'kilos',
  'varo',
  'varos',
  'baro',
  'baros',
  'medio',
  'media',
  'pesos',
  'peso',
  'pesitos',
  'cero',
  'nada',
]);

const tieneCifra = (t: readonly string[]) =>
  t.some((p) => /\d/.test(p) || PALABRAS_NUMERO.has(p) || /^veinti/.test(p));

const contiene = (t: readonly string[], ...secuencia: readonly string[]) =>
  t.some((_, i) => secuencia.every((p, k) => t[i + k] === p));

const DIAS = new Set(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
const PERIODO = new Set(['quincena', 'mes', 'semana', 'fin', 'llegar', 'llego', 'hoy', 'dia', 'pago']);

/** Inicios de un gasto dicho como hecho («compré…», «me eché…»), con «ya», «hoy» o «ayer» delante. */
const VERBOS_GASTO: readonly (readonly string[])[] = [
  ['me', 'compre'],
  ['me', 'eche'],
  ['me', 'tome'],
  ['compre'],
  ['gaste'],
  ['pague'],
  ['coopere'],
];
const PREVIOS = new Set(['ya', 'hoy', 'ayer', 'anoche', 'tambien']);

function empiezaConGasto(t: readonly string[]): boolean {
  let i = 0;
  while (i < t.length && PREVIOS.has(t[i] ?? '')) i++;
  return VERBOS_GASTO.some((v) => v.every((p, k) => t[i + k] === p));
}

/** Imperativos de mover dinero: la app solo lleva la cuenta (`08 §1`). */
const MOVER_DINERO = new Set([
  'transfiere',
  'transfierele',
  'transfiereles',
  'transfiereme',
  'deposita',
  'depositale',
  'depositame',
  'mandale',
  'mandame',
  'enviale',
  'enviame',
  'pagale',
  'paga',
]);
const RELLENO_INICIO = new Set(['oye', 'porfa', 'porfavor', 'favor', 'por']);
const INVERSION = new Set([
  'invertir',
  'inversion',
  'inversiones',
  'acciones',
  'cripto',
  'criptos',
  'criptomonedas',
  'bitcoin',
]);
const CONSEJO = new Set(['conviene', 'recomiendas', 'recomiendes', 'recomiendan', 'deberia', 'mejor']);

/** fuera_de_alcance claro (F01–F04 del golden set); cualquier otra cosa sigue su camino. */
export function fueraDeAlcance(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length === 0) return null;
  if (
    t.includes('prompt') ||
    ((t.includes('ignora') || t.includes('olvida') || t.includes('olvidate')) &&
      (t.includes('instrucciones') || t.includes('reglas'))) ||
    (t.includes('instrucciones') && (t.includes('dime') || t.includes('muestrame') || t.includes('ensename')))
  ) {
    return { intencion: 'fuera_de_alcance', motivo: 'instrucciones' };
  }
  let i = 0;
  while (i < t.length - 1 && RELLENO_INICIO.has(t[i] ?? '')) i++;
  if (
    MOVER_DINERO.has(t[i] ?? '') ||
    contiene(t, 'haz', 'una', 'transferencia') ||
    contiene(t, 'hazme', 'una', 'transferencia')
  ) {
    return { intencion: 'fuera_de_alcance', motivo: 'mueve_dinero' };
  }
  if (t.some((p) => INVERSION.has(p)) && t.some((p) => CONSEJO.has(p))) {
    return { intencion: 'fuera_de_alcance', motivo: 'asesoria_inversion' };
  }
  if (t.includes('chiste') || t.includes('chistes'))
    return { intencion: 'fuera_de_alcance', motivo: 'ajeno' };
  return null;
}

/** «¿Por qué…?» es una pregunta abierta sobre su dinero: el modo explicar (Plus) la contesta con sus herramientas. */
export function preguntaPorQue(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length < 4 || t[0] !== 'por' || t[1] !== 'que') return null;
  const pregunta = tokens.o
    .filter((p) => p !== SEP)
    .join(' ')
    .trim();
  return { intencion: 'consultar', consulta: { tipo: 'explicar', pregunta } };
}

/**
 * Aclaraciones que no necesitan a la nube. Van al final del nivel 0: solo si ninguna producción entendió la frase.
 * - un gasto dicho como hecho sin ninguna cifra («me compré una coca», «pagué la tarjeta») → monto_faltante;
 * - «la semana pasada» sin día al registrar → fecha_ambigua;
 * - un sueldo «bruto» → monto_ambiguo (se pregunta cuánto le llega);
 * - «¿me alcanza?» o «¿me alcanza para…?» sin precio → monto_faltante.
 */
export function aclaracionLocal(tokens: Tokens): Interpretacion | null {
  const t = tokens.t.filter((p) => p !== SEP);
  if (t.length === 0 || t[0] === 'no') return null;
  const cifra = tieneCifra(t);
  if ((t.includes('brutos') || t.includes('bruto')) && cifra) {
    return {
      intencion: 'aclarar',
      motivo: 'monto_ambiguo',
      pregunta: '¿Cuánto te llega ya con descuentos?',
    };
  }
  // «¿me alcanza para llegar a la quincena?» no es una compra: esa la decide la nube (o una consulta).
  const hablaDelPeriodo = t.some((p) => PERIODO.has(p));
  if (t[0] === 'me' && (t[1] === 'alcanza' || t[1] === 'alcanzaria') && !cifra && !hablaDelPeriodo) {
    return {
      intencion: 'aclarar',
      motivo: 'monto_faltante',
      pregunta: '¿Cuánto cuesta lo que quieres comprar?',
    };
  }
  if (!empiezaConGasto(t)) return null;
  if (!cifra) return { intencion: 'aclarar', motivo: 'monto_faltante', pregunta: '¿Cuánto fue?' };
  if (contiene(t, 'semana', 'pasada') && !t.some((p) => DIAS.has(p))) {
    return { intencion: 'aclarar', motivo: 'fecha_ambigua', pregunta: '¿Qué día de la semana pasada fue?' };
  }
  return null;
}
