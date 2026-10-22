/**
 * GASTO_COMPARTIDO del nivel 0 (docs/06-NLU.md §9, `02 §27`): una SEÑAL y, en cualquier orden, [PAGADOR]
 * [PROPORCION] y `[de|por]? MONTO [de|del|en|por]? DESC_CONOCIDA` o `DESC_CONOCIDA [de|del|en|por]? MONTO`, con
 * fecha relativa opcional al inicio. Con señal, la frase es esto o nada: nunca un gasto personal.
 */
import type { Centavos } from '@cartera/core';
import type { Categoria, Interpretacion } from '../esquema';
import { buscarEnDiccionario } from './diccionario';
import type { Entorno } from './entorno';
import { leerFechaRegistro } from './fechas';
import { Lector } from './lector';
import { leerMonto } from './montos';
import { ARTICULOS, type Tokens, palabraDesc, recortar, sinSeparadores } from './tokens';

/** Entre el monto y la descripción ("500 en gasolina", "300 del cine", "luz de 900"). */
const CONECTORES_MONTO = new Set(['de', 'del', 'en', 'por']);
const PAREJA = ['pareja', 'esposa', 'esposo', 'novia', 'novio'];
/** Señales de que el gasto es compartido con la pareja; sin una de ellas no es `gasto_compartido`. */
const MARCAS_COMPARTIDO: readonly (readonly string[])[] = [
  ['gasto', 'compartido'],
  ['compartido'],
  ['compartida'],
  ['mitad', 'y', 'mitad'],
  ['a', 'medias'],
  ...PAREJA.map((p) => ['con', 'mi', p]),
];
const PAGUE_YO: readonly (readonly string[])[] = [
  ['lo', 'pague', 'yo'],
  ['pague', 'yo'],
  ['yo', 'pague'],
  ['lo', 'pague'],
  ['pague'],
];
const PAGO_PAREJA: readonly (readonly string[])[] = [
  ...['ella', 'el'].flatMap((x) => [
    ['lo', 'pago', x],
    ['pago', x],
  ]),
  ...PAREJA.flatMap((p) => [
    ['lo', 'pago', 'mi', p],
    ['pago', 'mi', p],
  ]),
];
/** "60/40": las dos partes, de 1 a 99 y que sumen 100. */
const PATRON_PROPORCION = /^(\d{1,2})\/(\d{1,2})$/;

interface Pieza {
  x: string;
  original: string;
}

function montoYDesc(
  resto: readonly Pieza[],
  env: Entorno,
): { monto: Centavos; descripcion: string; categoria?: Categoria } | null {
  const lector = new Lector({
    t: resto.map((p) => p.x),
    o: resto.map((p) => p.original),
    c: resto.map((p) => p.original),
  });
  // El primer monto de izquierda a derecha; cualquier otro fuera de ese tramo vuelve la frase ambigua.
  let pos = -1;
  let finMonto = -1;
  let lectura: ReturnType<typeof leerMonto> = null;
  for (let p = 0; p < resto.length && lectura === null; p++) {
    lector.volver(p);
    lectura = leerMonto(lector);
    if (lectura) {
      pos = p;
      finMonto = lector.pos;
    }
  }
  if (!lectura || lectura.monto <= 0) return null;
  for (let p = 0; p < resto.length; p++) {
    if (p >= pos && p < finMonto) continue;
    lector.volver(p);
    if (leerMonto(lector)) return null;
  }
  let desc: readonly Pieza[];
  if (pos === 0 || (pos === 1 && (resto[0]?.x === 'de' || resto[0]?.x === 'por'))) {
    desc = resto.slice(finMonto);
    if (CONECTORES_MONTO.has(desc[0]?.x ?? '')) desc = desc.slice(1);
  } else if (finMonto === resto.length) {
    desc = resto.slice(0, pos);
    if (CONECTORES_MONTO.has(desc[desc.length - 1]?.x ?? '')) desc = desc.slice(0, -1);
  } else {
    return null;
  }
  if (desc.length > 1 && ARTICULOS.has(desc[0]?.x ?? '')) desc = desc.slice(1);
  const palabras = desc.map((p) => p.x);
  if (palabras.length < 1 || palabras.length > 3) return null;
  if (palabras.some((p) => !palabraDesc(p) || env.nombres.has(p))) return null;
  const { categorias, cubiertas } = buscarEnDiccionario(palabras);
  if (!cubiertas.every(Boolean)) return null;
  const descripcion = desc.map((p) => p.original).join(' ');
  const [categoria] = categorias;
  return categorias.size === 1 && categoria
    ? { monto: lectura.monto, descripcion, categoria }
    : { monto: lectura.monto, descripcion };
}

/**
 * `undefined` si no hay señal (la frase sigue a las demás reglas); `null` si la hay pero no está seguro. Si pagó tu
 * pareja y el reparto no es parejo, no adivina de quién es cada parte (`null`).
 */
export function compartido(tokens: Tokens, env: Entorno): Interpretacion | null | undefined {
  const conFecha = new Lector(tokens);
  const fecha = leerFechaRegistro(conFecha, env.hoy) ?? env.hoy;
  const sinFecha = sinSeparadores(recortar(tokens, conFecha.pos, tokens.t.length));
  const t = sinFecha.t;
  const originales = sinFecha.o;
  const usados = t.map(() => false);
  const quitar = (secuencia: readonly string[]): number => {
    for (let i = 0; i + secuencia.length <= t.length; i++) {
      if (secuencia.every((p, k) => t[i + k] === p && !usados[i + k])) {
        for (let k = 0; k < secuencia.length; k++) usados[i + k] = true;
        return i;
      }
    }
    return -1;
  };

  const proporciones = t.flatMap((x, i) => {
    const m = PATRON_PROPORCION.exec(x);
    return m ? [{ i, a: Number(m[1]), b: Number(m[2]) }] : [];
  });
  let senal = proporciones.length > 0;
  for (const marca of MARCAS_COMPARTIDO) if (quitar(marca) !== -1) senal = true;
  if (!senal) return undefined;

  const [proporcion, otra] = proporciones;
  if (otra) return null;
  if (proporcion) {
    if (proporcion.a < 1 || proporcion.b < 1 || proporcion.a + proporcion.b !== 100) return null;
    usados[proporcion.i] = true;
  }

  const pagoYo = PAGUE_YO.some((s) => quitar(s) !== -1);
  let pagoPareja = PAGO_PAREJA.some((s) => quitar(s) !== -1);
  let grupo: string | undefined;
  const posPago = quitar(['pago']);
  if (posPago !== -1) {
    const nombre = t[posPago + 1];
    if (nombre === undefined || usados[posPago + 1] || !env.esNombre(nombre)) return null;
    usados[posPago + 1] = true;
    pagoPareja = true;
    grupo = nombre;
  }
  if (pagoYo && pagoPareja) return null;
  const pagador = pagoYo ? 'yo' : pagoPareja ? 'pareja' : undefined;

  let miParte = 50;
  if (proporcion && proporcion.a !== proporcion.b) {
    if (pagador !== 'yo') return null;
    miParte = proporcion.a;
  }

  const resto = t.flatMap((x, i) => (usados[i] ? [] : [{ x, original: originales[i] ?? x }]));
  const lectura = montoYDesc(resto, env);
  if (!lectura) return null;
  return {
    intencion: 'gasto_compartido',
    gasto: {
      monto: lectura.monto,
      fecha,
      descripcion: lectura.descripcion,
      ...(lectura.categoria ? { categoria: lectura.categoria } : {}),
      ...(pagador ? { pagador } : {}),
      mi_parte: miParte,
      ...(grupo ? { grupo } : {}),
    },
  };
}
