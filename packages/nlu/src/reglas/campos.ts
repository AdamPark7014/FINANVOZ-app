/**
 * Gramáticas de campo del nivel 0 (docs/06-NLU.md §9.4): lo que se dicta en un campo de un formulario, no una frase
 * libre. Viven fuera de `PRODUCCIONES` para no mover el golden set. Deterministas y sin red; ante la duda, `null`.
 */
import type { Centavos, DiaSemana } from '@cartera/core';
import { DIAS, leerRegla } from './configurar';
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

/** Frecuencias del paso de ingreso (O3) con lo que se haya dicho de su día; lo que falte se elige en pantalla. */
export type IngresoDicho = LecturaMonto &
  (
    | { frecuencia: 'quincena' }
    | { frecuencia: 'semanal'; diaSemana: DiaSemana | null }
    | { frecuencia: 'catorcenal' }
    | { frecuencia: 'mensual'; diaMes: number | null }
    | { frecuencia: null }
  );

const VERBOS_INGRESO: readonly (readonly string[])[] = [
  ['me', 'pagan'],
  ['me', 'depositan'],
  ['me', 'cae'],
  ['me', 'caen'],
  ['cobro'],
  ['gano'],
  ['son'],
  ['es'],
];

/** Frecuencia sin la regla completa: «cada mes», «al mes», «cada semana», «cada 14 días». */
function frecuenciaParcial(l: Lector): IngresoDicho['frecuencia'] | undefined {
  if (l.alguna(['a', 'la', 'quincena'], ['por', 'quincena'], ['quincenal'], ['cada', 'quincena']))
    return 'quincena';
  if (l.alguna(['cada', 'semana'], ['a', 'la', 'semana'], ['por', 'semana'], ['semanal'])) return 'semanal';
  if (
    l.alguna(['cada', '14', 'dias'], ['cada', 'catorce', 'dias'], ['cada', 'dos', 'semanas'], ['catorcenal'])
  )
    return 'catorcenal';
  if (l.alguna(['cada', 'mes'], ['al', 'mes'], ['por', 'mes'], ['mensual'], ['mensuales'])) return 'mensual';
  return undefined;
}

/**
 * INGRESO_DICHO := [VERBO] MONTO [REGLA | FRECUENCIA] — «gano doce mil cada quincena», «me pagan 8 mil cada
 * viernes», «15 mil al mes». Sin frecuencia, `frecuencia: null`: la persona la elige en los chips.
 */
export function interpretarIngresoDicho(texto: string): IngresoDicho | null {
  const l = new Lector(tokenizar(texto));
  l.alguna(...VERBOS_INGRESO);
  const lectura = leerMonto(l);
  if (lectura === null || lectura.monto <= 0) return null;
  if (l.fin) return { ...lectura, frecuencia: null };
  const marca = l.marca();
  const regla = leerRegla(l);
  if (regla && l.fin) {
    switch (regla.tipo) {
      case 'quincenal_15_ultimo':
        return { ...lectura, frecuencia: 'quincena' };
      case 'semanal':
        return { ...lectura, frecuencia: 'semanal', diaSemana: regla.dia_semana as DiaSemana };
      case 'mensual':
        return { ...lectura, frecuencia: 'mensual', diaMes: regla.dia };
      default:
        return null;
    }
  }
  l.volver(marca);
  const frecuencia = frecuenciaParcial(l);
  if (frecuencia === undefined) return null;
  if (frecuencia === 'semanal' || frecuencia === 'mensual') {
    // «cada semana el viernes», «cada mes el 30» ya los cubre `leerRegla`; aquí el día no se dijo.
    if (!l.fin) {
      if (frecuencia === 'semanal' && l.palabra('el', 'los')) {
        const dia = DIAS[l.ver() ?? ''];
        if (dia !== undefined) {
          l.pos++;
          return l.fin ? { ...lectura, frecuencia, diaSemana: dia } : null;
        }
      }
      return null;
    }
    return frecuencia === 'semanal'
      ? { ...lectura, frecuencia, diaSemana: null }
      : { ...lectura, frecuencia, diaMes: null };
  }
  return l.fin ? { ...lectura, frecuencia } : null;
}

export type FrecuenciaPagoDicha = 'mensual' | 'quincenal' | 'semanal' | 'anual';

/** Un pago fijo de O5 dicho de una vez; lo que no se dijo (día, mes) queda vacío y se elige en pantalla. */
export interface PagoFijoDicho extends LecturaMonto {
  /** Como se dijo, sin artículo: «renta», «Netflix», «la colegiatura» → «colegiatura». */
  concepto: string;
  frecuencia: FrecuenciaPagoDicha | null;
  diaMes: number | null;
  diaSemana: DiaSemana | null;
  mes: number | null;
}

const VERBOS_PAGO: readonly (readonly string[])[] = [
  ['tengo', 'que', 'pagar'],
  ['debo', 'pagar'],
  ['me', 'toca', 'pagar'],
  ['pago'],
];
const UNION_MONTO: readonly (readonly string[])[] = [
  ['me', 'cuesta'],
  ['sale', 'en'],
  ['cuesta'],
  ['son'],
  ['es'],
  ['de'],
];
/** Donde termina el concepto y empieza la frecuencia o el monto. */
const FIN_CONCEPTO = new Set([
  'cada',
  'el',
  'los',
  'al',
  'a',
  'por',
  'todos',
  'mensual',
  'quincenal',
  'semanal',
  'anual',
]);
const ARTICULOS_CONCEPTO = new Set(['la', 'el', 'los', 'las', 'mi', 'mis', 'un', 'una']);
const MAX_PALABRAS_CONCEPTO = 4;

/** Palabras del concepto en su forma original (con mayúsculas); `null` si no hay o son demasiadas. */
function leerConcepto(l: Lector, terminaEn: (k: number) => boolean): string | null {
  while (ARTICULOS_CONCEPTO.has(l.ver() ?? '')) l.pos++;
  const inicio = l.pos;
  while (!l.fin && !terminaEn(0)) {
    const p = l.ver() ?? '';
    if (!/^[a-zñ]+$/.test(p)) break;
    l.pos++;
  }
  const n = l.pos - inicio;
  if (n === 0 || n > MAX_PALABRAS_CONCEPTO) return null;
  return l.tokens.c.slice(inicio, l.pos).join(' ');
}

/** «cada mes el 5», «el 5 de cada mes», «cada mes», «al año», «cada quincena»… Debe terminar la frase. */
function frecuenciaDePago(
  l: Lector,
): Pick<PagoFijoDicho, 'frecuencia' | 'diaMes' | 'diaSemana' | 'mes'> | null {
  const nada = { frecuencia: null, diaMes: null, diaSemana: null, mes: null } as const;
  if (l.fin) return nada;
  const marca = l.marca();
  const regla = leerRegla(l);
  if (regla && l.fin) {
    switch (regla.tipo) {
      case 'mensual':
        return { ...nada, frecuencia: 'mensual', diaMes: regla.dia };
      case 'quincenal_15_ultimo':
        return { ...nada, frecuencia: 'quincenal' };
      case 'semanal':
        return { ...nada, frecuencia: 'semanal', diaSemana: regla.dia_semana as DiaSemana };
      case 'anual':
        return { ...nada, frecuencia: 'anual', diaMes: regla.dia, mes: regla.mes };
      default:
        return null;
    }
  }
  l.volver(marca);
  let frecuencia: FrecuenciaPagoDicha | null = null;
  if (l.alguna(['cada', 'mes'], ['al', 'mes'], ['por', 'mes'], ['mensual'], ['mensuales']))
    frecuencia = 'mensual';
  else if (l.alguna(['cada', 'quincena'], ['a', 'la', 'quincena'], ['por', 'quincena'], ['quincenal']))
    frecuencia = 'quincenal';
  else if (l.alguna(['cada', 'semana'], ['a', 'la', 'semana'], ['por', 'semana'], ['semanal']))
    frecuencia = 'semanal';
  else if (l.alguna(['cada', 'año'], ['al', 'año'], ['por', 'año'], ['anual'])) frecuencia = 'anual';
  return frecuencia !== null && l.fin ? { ...nada, frecuencia } : null;
}

/**
 * PAGO_DICHO := (pago | tengo que pagar | debo pagar) MONTO (de | del | por) CONCEPTO [FRECUENCIA]
 *             | CONCEPTO (son | es | cuesta | me cuesta | sale en | de) MONTO [FRECUENCIA]
 *             | CONCEPTO MONTO [FRECUENCIA]
 * «pago 4500 de renta cada mes el 5», «la luz son 450 cada mes», «Netflix 299 al mes».
 */
export function interpretarPagoFijoDicho(texto: string): PagoFijoDicho | null {
  const l = new Lector(tokenizar(texto));
  if (l.fin) return null;
  const terminaEnFrecuencia = (k: number) => FIN_CONCEPTO.has(l.ver(k) ?? '');

  if (l.alguna(...VERBOS_PAGO)) {
    const lectura = leerMonto(l);
    if (lectura === null || lectura.monto <= 0 || !l.palabra('de', 'del', 'por')) return null;
    const concepto = leerConcepto(l, terminaEnFrecuencia);
    if (concepto === null) return null;
    const f = frecuenciaDePago(l);
    return f ? { ...lectura, concepto, ...f } : null;
  }

  const concepto = leerConcepto(
    l,
    (k) => terminaEnFrecuencia(k) || UNION_MONTO.some((u) => u[0] === l.ver(k)),
  );
  if (concepto === null) return null;
  l.alguna(...UNION_MONTO);
  const lectura = leerMonto(l);
  if (lectura === null || lectura.monto <= 0) return null;
  const f = frecuenciaDePago(l);
  return f ? { ...lectura, concepto, ...f } : null;
}
