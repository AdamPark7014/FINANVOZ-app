/**
 * O4 · tarjeta de crédito (docs/06-NLU.md §13, `02 §3.1`). Datos en cualquier orden separados por "y" o coma, cada
 * uno a lo más una vez; un dato que no se entiende anula la frase.
 *
 *   TARJETA := DATO ((y | , | , y) DATO)*
 *   DATO    := [tengo una|mi|la|la de|una] [tarjeta] [de crédito] [NOMBRE] [que] corta el [día] N     → nombre, corte
 *            | (pago|la pago|se paga|vence|tengo que pagar|la tengo que pagar) el [día] M            → día límite
 *            | tengo M días para pagar                                                              → días para pagar
 *            | (debo|le debo|traigo) MONTO0 | no [le] debo nada | está en ceros                     → saldo
 *            | (mi límite es [de] | el límite es [de] | de límite tengo | tengo de límite
 *              | tengo un límite de | me prestan [hasta]) MONTO                                     → límite
 *            | la pago completa [cada mes] | siempre la pago completa | pago el total               → totalero
 *            | no [siempre] la pago completa | [solo] pago el mínimo                                → plan
 *            | [que] termina en DDDD | con terminación DDDD                                       → últimos 4
 *            | tengo una compra a meses de MONTO [al mes|mensuales] [,] [y] me faltan N [pagos|meses|mensualidades]
 *   NOMBRE  := institución del catálogo con crédito | 1 o 2 palabras de letras justo antes de "[que] corta"
 *
 * Nunca se infiere si el saldo ya incluye los meses ("debo 12 mil pero 4 son de meses" → `null`): eso lo pregunta
 * la tarjeta (`02 §3.1` paso 4). Dos compras a meses en una frase → `null`.
 */
import { Lector } from '../reglas/lector';
import { leerEntero } from '../reglas/montos';
import { ARTICULOS, PALABRAS_PROHIBIDAS_DESC, PALABRAS_QUE_DESCARTAN, type Tokens } from '../reglas/tokens';
import { leerCifra, mayusculaInicial, partir } from './comun';
import type { Cifra, LecturaPaso } from './esquema';
import { leerInstitucion } from './instituciones';

type LecturaTarjeta = Extract<LecturaPaso, { paso: 'tarjeta' }>;

type Dato =
  | { tipo: 'corte'; nombre?: string; diaCorte: number }
  | { tipo: 'pago'; diaLimitePago: number }
  | { tipo: 'pago'; diasParaPagar: number }
  | { tipo: 'saldo'; saldo: Cifra }
  | { tipo: 'limite'; limiteCredito: Cifra }
  | { tipo: 'modo'; modo: 'totalero' | 'plan' }
  | { tipo: 'ultimos4'; ultimos4: string }
  | { tipo: 'msi'; mensualidad: number; restantes: number };

const PREFIJOS_TARJETA: readonly (readonly string[])[] = [
  ['tengo', 'una', 'tarjeta', 'de', 'credito'],
  ['tengo', 'una', 'tarjeta'],
  ['tengo', 'una'],
  ['tengo', 'un'],
  ['mi', 'tarjeta', 'de', 'credito'],
  ['mi', 'tarjeta'],
  ['la', 'tarjeta', 'de', 'credito'],
  ['la', 'tarjeta'],
  ['una', 'tarjeta', 'de', 'credito'],
  ['una', 'tarjeta'],
  ['tarjeta', 'de', 'credito'],
  ['tarjeta'],
  ['la', 'de'],
  ['mi'],
  ['la'],
  ['una'],
  [],
];
const DIA_LIMITE: readonly (readonly string[])[] = [
  ['la', 'tengo', 'que', 'pagar', 'el'],
  ['tengo', 'que', 'pagar', 'el'],
  ['la', 'pago', 'el'],
  ['se', 'paga', 'el'],
  ['pago', 'el'],
  ['vence', 'el'],
];
const SALDO_CERO: readonly (readonly string[])[] = [
  ['no', 'le', 'debo', 'nada'],
  ['no', 'debo', 'nada'],
  ['la', 'traigo', 'en', 'ceros'],
  ['esta', 'en', 'ceros'],
  ['esta', 'en', 'cero'],
];
const LIMITE: readonly (readonly string[])[] = [
  ['mi', 'limite', 'es', 'de'],
  ['mi', 'limite', 'es'],
  ['el', 'limite', 'es', 'de'],
  ['el', 'limite', 'es'],
  ['de', 'limite', 'tengo'],
  ['tengo', 'de', 'limite'],
  ['tengo', 'un', 'limite', 'de'],
  ['me', 'prestan', 'hasta'],
  ['me', 'prestan'],
];
const TOTALERO: readonly (readonly string[])[] = [
  ['siempre', 'la', 'pago', 'completa'],
  ['la', 'pago', 'completa', 'cada', 'mes'],
  ['la', 'pago', 'completa'],
  ['pago', 'el', 'total'],
];
const PLAN: readonly (readonly string[])[] = [
  ['no', 'siempre', 'la', 'pago', 'completa'],
  ['no', 'la', 'pago', 'completa'],
  ['solo', 'pago', 'el', 'minimo'],
  ['pago', 'el', 'minimo'],
];

/** NOMBRE fuera del catálogo: 1 o 2 palabras de letras que no son de enlace, artículos ni de las que descartan. */
function palabraNombre(p: string | undefined): boolean {
  return (
    p !== undefined &&
    /^[a-zñ]+$/.test(p) &&
    p !== 'que' &&
    p !== 'corta' &&
    !ARTICULOS.has(p) &&
    !PALABRAS_PROHIBIDAS_DESC.has(p) &&
    !PALABRAS_QUE_DESCARTAN.has(p)
  );
}

/** "[que] corta el [día] N" hasta el final del tramo. */
function cortaEl(l: Lector): number | null {
  l.palabra('que');
  if (!l.secuencia('corta', 'el')) return null;
  l.palabra('dia');
  const n = leerEntero(l, 31);
  return n !== null && l.fin ? n : null;
}

function leerCorte(l: Lector): Dato | null {
  for (const prefijo of PREFIJOS_TARJETA) {
    l.volver(0);
    if (!l.secuencia(...prefijo)) continue;
    const despues = l.marca();
    // Sin nombre: "corta el 28".
    const sinNombre = cortaEl(l);
    if (sinNombre !== null) return { tipo: 'corte', diaCorte: sinNombre };
    // Del catálogo: "mi Nu corta el 28".
    l.volver(despues);
    const i = leerInstitucion(l, 'credito');
    if (i) {
      const dia = cortaEl(l);
      if (dia !== null) return { tipo: 'corte', nombre: i.nombre, diaCorte: dia };
    }
    // Fuera del catálogo: "la oro corta el 10", "la azul que corta el 5".
    for (const n of [1, 2]) {
      l.volver(despues);
      const palabras = l.t.slice(despues, despues + n);
      if (palabras.length !== n || !palabras.every(palabraNombre)) continue;
      l.pos += n;
      const dia = cortaEl(l);
      if (dia !== null)
        return { tipo: 'corte', nombre: mayusculaInicial(l.original(despues, despues + n)), diaCorte: dia };
    }
  }
  return null;
}

function leerDato(tramo: Tokens): Dato | null {
  const l = new Lector(tramo);
  const fin = <T extends Dato>(d: T | null): T | null => (d !== null && l.fin ? d : null);

  const corte = leerCorte(l);
  if (corte) return corte;

  l.volver(0);
  if (l.alguna(...DIA_LIMITE)) {
    l.palabra('dia');
    const m = leerEntero(l, 31);
    if (m !== null && l.fin) return { tipo: 'pago', diaLimitePago: m };
  }
  l.volver(0);
  if (l.palabra('tengo')) {
    const dias = leerEntero(l, 60);
    if (dias !== null && l.secuencia('dias', 'para', 'pagar') && l.fin)
      return { tipo: 'pago', diasParaPagar: dias };
  }

  l.volver(0);
  if (l.alguna(...SALDO_CERO)) return fin({ tipo: 'saldo', saldo: { monto: 0, aproximado: false } });
  l.volver(0);
  if (l.alguna(['le', 'debo'], ['debo'], ['traigo'])) {
    const saldo = leerCifra(l, true);
    if (saldo && l.fin) return { tipo: 'saldo', saldo };
  }

  l.volver(0);
  if (l.alguna(...LIMITE)) {
    const limite = leerCifra(l, false);
    if (limite && l.fin) return { tipo: 'limite', limiteCredito: limite };
  }

  l.volver(0);
  if (l.alguna(...TOTALERO) && l.fin) return { tipo: 'modo', modo: 'totalero' };
  l.volver(0);
  if (l.alguna(...PLAN) && l.fin) return { tipo: 'modo', modo: 'plan' };

  l.volver(0);
  if (l.alguna(['que', 'termina', 'en'], ['termina', 'en'], ['con', 'terminacion'], ['terminacion'])) {
    const digitos = l.ver();
    if (digitos !== undefined && /^\d{4}$/.test(digitos)) {
      l.pos++;
      if (l.fin) return { tipo: 'ultimos4', ultimos4: digitos };
    }
  }

  l.volver(0);
  if (l.secuencia('tengo', 'una', 'compra', 'a', 'meses', 'de')) {
    const mensualidad = leerCifra(l, false);
    if (mensualidad) {
      l.alguna(['al', 'mes'], ['mensuales']);
      l.sep();
      l.palabra('y');
      if (l.alguna(['me', 'faltan'], ['le', 'faltan'], ['faltan'], ['me', 'quedan'])) {
        const restantes = leerEntero(l, 48);
        l.palabra('pagos', 'meses', 'mensualidades');
        if (restantes !== null && l.fin) return { tipo: 'msi', mensualidad: mensualidad.monto, restantes };
      }
    }
  }
  return null;
}

const MAX_DATOS = 8;

/** "Mi BBVA corta el 5, pago el 25, mi límite es de 30 mil y debo como 4 mil 200". */
export function leerTarjeta(tokens: Tokens): LecturaTarjeta | null {
  const datos = partir(tokens, leerDato, MAX_DATOS);
  if (!datos) return null;
  const vistos = new Set<Dato['tipo']>();
  let lectura: LecturaTarjeta = { paso: 'tarjeta' };
  for (const d of datos) {
    if (vistos.has(d.tipo)) return null; // cada dato una vez (dos compras a meses, dos cortes…)
    vistos.add(d.tipo);
    switch (d.tipo) {
      case 'corte':
        lectura = { ...lectura, ...(d.nombre ? { nombre: d.nombre } : {}), diaCorte: d.diaCorte };
        break;
      case 'pago':
        lectura = {
          ...lectura,
          ...('diaLimitePago' in d ? { diaLimitePago: d.diaLimitePago } : { diasParaPagar: d.diasParaPagar }),
        };
        break;
      case 'saldo':
        lectura = { ...lectura, saldo: d.saldo };
        break;
      case 'limite':
        lectura = { ...lectura, limiteCredito: d.limiteCredito };
        break;
      case 'modo':
        lectura = { ...lectura, modo: d.modo };
        break;
      case 'ultimos4':
        lectura = { ...lectura, ultimos4: d.ultimos4 };
        break;
      case 'msi':
        lectura = { ...lectura, msiPrevios: [{ mensualidad: d.mensualidad, restantes: d.restantes }] };
        break;
    }
  }
  return lectura;
}
