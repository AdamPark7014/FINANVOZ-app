/**
 * Montos del nivel 0 (docs/06-NLU.md §3.1 Montos y §9 MONTO): dígitos en formato mexicano, "N mil", "1.5k",
 * cardinales en palabras, jerga (varos, kilo, luca) y las marcas de aproximado. Siempre a centavos enteros.
 * A0: "treinta y un mil" / "treinta y un pesos"; A1: "8 mil 500" / "8 mil quinientos"; A2: "85 pesos con 50 centavos".
 */
import type { Centavos } from '@cartera/core';
import type { Lector } from './lector';

export interface LecturaMonto {
  monto: Centavos;
  aproximado: boolean;
}

const PATRON_DIGITOS = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;
const PATRON_MILES_K = /^\$?(\d+)(?:\.(\d{1,2}))?k$/;
const PATRON_ENTERO_CORTO = /^\d{1,3}(?:\.\d{1,2})?$/;
const MAX_DIGITOS_ENTEROS = 9;

const UNIDADES: Readonly<Record<string, number>> = {
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
const DECENAS: Readonly<Record<string, number>> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};
const CENTENAS: Readonly<Record<string, number>> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};
/** "un kilo", "una luca": mil pesos; "medio kilo": quinientos. */
const MIL_JERGA = new Set(['kilo', 'kilos', 'luca', 'lucas']);
const MONEDA = new Set(['pesos', 'peso', 'pesitos', 'varos', 'varo', 'baros', 'baro']);
const APROX_ANTES: readonly (readonly string[])[] = [
  ['mas', 'o', 'menos'],
  ['aproximadamente'],
  ['aprox'],
  ['como'],
  ['unos'],
  ['unas'],
];
const APROX_DESPUES: readonly (readonly string[])[] = [
  ['y', 'feria'],
  ['y', 'pico'],
  ['mas', 'o', 'menos'],
  ['aproximadamente'],
  ['aprox'],
];

const esPalabraNumero = (p: string | undefined) =>
  p !== undefined &&
  (p in UNIDADES || p in DECENAS || p in CENTENAS || p === 'un' || p === 'una' || p === 'mil');

/** Token que empieza con una cifra ("500", "1,250", "$80"): otra cifra pegada. */
const esCifraEnDigitos = (p: string | undefined) => p !== undefined && /^\$?\d/.test(p);

const antesDeMilOMoneda = (p: string | undefined) => p === 'mil' || (p !== undefined && MONEDA.has(p));

/** Grupo de hasta tres cifras en palabras ("ciento ochenta y cinco"); `null` si no hay grupo o está mal formado. */
function grupoEnPalabras(l: Lector): number | null {
  const inicio = l.marca();
  let valor = 0;
  let hayAlgo = false;
  const primera = l.ver();
  if (primera !== undefined && primera in CENTENAS) {
    valor = CENTENAS[primera] ?? 0;
    l.pos++;
    hayAlgo = true;
    if (primera === 'cien') return valor; // "cien" no admite decenas detrás ("ciento" sí)
  }
  const siguiente = l.ver();
  if (siguiente !== undefined && siguiente in DECENAS) {
    valor += DECENAS[siguiente] ?? 0;
    l.pos++;
    hayAlgo = true;
    if (l.ver() === 'y') {
      const unidad = l.ver(1);
      let u = unidad === undefined ? undefined : UNIDADES[unidad];
      // A0: "treinta y un mil", "treinta y un pesos": "un"/"una" es la unidad solo ante "mil" o la moneda.
      if (u === undefined && (unidad === 'un' || unidad === 'una') && antesDeMilOMoneda(l.ver(2))) u = 1;
      if (u === undefined || u > 9) {
        l.volver(inicio);
        return null;
      }
      valor += u;
      l.pos += 2;
    }
  } else if (
    siguiente !== undefined &&
    (siguiente in UNIDADES || siguiente === 'un' || siguiente === 'una')
  ) {
    valor += UNIDADES[siguiente] ?? 1;
    l.pos++;
    hayAlgo = true;
  } else if (primera === 'ciento') {
    // "ciento" exige algo detrás.
    l.volver(inicio);
    return null;
  }
  return hayAlgo ? valor : null;
}

/** Cardinal completo en palabras, con "mil" opcional ("mil quinientos", "veinticinco mil"). En pesos enteros. */
function cardinalEnPalabras(l: Lector): number | null {
  const inicio = l.marca();
  const primero = l.ver();
  const grupo = grupoEnPalabras(l);
  let pesos: number;
  if (l.ver() === 'mil') {
    l.pos++;
    pesos = (grupo ?? 1) * 1000;
    const resto = grupoEnPalabras(l);
    if (resto !== null) pesos += resto;
  } else if (grupo === null || primero === 'un' || primero === 'una') {
    // "un"/"una" solos son artículos, no un peso.
    l.volver(inicio);
    return null;
  } else {
    pesos = grupo;
  }
  // Otra cifra pegada ("dos cincuenta") es ambigua: no se adivina.
  if (esPalabraNumero(l.ver())) {
    l.volver(inicio);
    return null;
  }
  return pesos;
}

function aCentavos(enteros: string, decimales: string | undefined): Centavos | null {
  const limpios = enteros.replace(/,/g, '').replace(/^0+(?=\d)/, '');
  if (limpios.length > MAX_DIGITOS_ENTEROS) return null;
  return Number(limpios) * 100 + Number((decimales ?? '').padEnd(2, '0'));
}

/** Número con dígitos: "1,250.50", "$96", "1.5k", "8 mil", "1.5 mil". */
function conDigitos(l: Lector): Centavos | null {
  const inicio = l.marca();
  let token = l.ver();
  if (token === undefined) return null;
  if (token === '$') {
    l.pos++;
    token = l.ver();
    if (token === undefined || token.startsWith('$')) {
      l.volver(inicio);
      return null;
    }
  }
  const miles = PATRON_MILES_K.exec(token);
  if (miles) {
    l.pos++;
    const centavos = aCentavos(miles[1] ?? '', miles[2]);
    return centavos === null ? null : centavos * 1000;
  }
  const partes = PATRON_DIGITOS.exec(token);
  if (!partes) {
    l.volver(inicio);
    return null;
  }
  l.pos++;
  const centavos = aCentavos(partes[1] ?? '', partes[2]);
  if (centavos === null) {
    l.volver(inicio);
    return null;
  }
  if (l.ver() === 'mil') {
    // "8 mil", "1.5 mil": solo enteros cortos o con decimales, nunca "1,500 mil".
    const numero = token.replace(/^\$/, '');
    if (!PATRON_ENTERO_CORTO.test(numero)) {
      l.volver(inicio);
      return null;
    }
    l.pos++;
    const sigue = l.ver();
    if (!esCifraEnDigitos(sigue) && !esPalabraNumero(sigue)) return centavos * 1000;
    // A1: "8 mil 500", "8 mil quinientos" (N entero 1–999 y M 1–999). Cualquier otra cifra pegada → null.
    const resto = /^\d{1,3}$/.test(numero) ? restoDeMiles(l) : null;
    if (resto === null || esCifraEnDigitos(l.ver()) || esPalabraNumero(l.ver())) {
      l.volver(inicio);
      return null;
    }
    return centavos * 1000 + resto * 100;
  }
  return centavos;
}

/** M de "N mil M": 1–999 en dígitos sin coma ni decimales, o un grupo en palabras ("quinientos"); nunca "un" solo. */
function restoDeMiles(l: Lector): number | null {
  const token = l.ver();
  if (token === undefined) return null;
  if (/^\d{1,3}$/.test(token)) {
    const n = Number(token);
    if (n < 1) return null;
    l.pos++;
    return n;
  }
  if (token === 'un' || token === 'una') return null;
  const grupo = grupoEnPalabras(l);
  return grupo !== null && grupo >= 1 && grupo <= 999 ? grupo : null;
}

/** "un kilo", "dos lucas", "medio kilo"; nunca seguidos de "de" ("un kilo de carne" pesa, no cuesta). */
function jerga(l: Lector): Centavos | null {
  const inicio = l.marca();
  let miles: number | null = null;
  if (l.palabra('medio', 'media')) miles = 0.5;
  else {
    const grupo = grupoEnPalabras(l);
    if (grupo !== null && grupo <= 99) miles = grupo;
  }
  const unidad = l.ver();
  if (miles === null || unidad === undefined || !MIL_JERGA.has(unidad)) {
    l.volver(inicio);
    return null;
  }
  l.pos++;
  if (l.ver() === 'de' || l.ver() === 'del' || l.ver() === 'y') {
    l.volver(inicio);
    return null;
  }
  return Math.round(miles * 100_000);
}

/**
 * Lee un monto en la posición del cursor (lo consume, con la moneda y las marcas de aproximado si las hay).
 * Devuelve `null` sin mover el cursor si ahí no hay un monto bien formado o es ambiguo.
 */
export function leerMonto(l: Lector): LecturaMonto | null {
  const inicio = l.marca();
  let aproximado = false;
  if (APROX_ANTES.some((s) => l.secuencia(...s))) aproximado = true;
  const despuesDeAprox = l.marca();
  let monto = conDigitos(l);
  if (monto === null) monto = jerga(l);
  if (monto === null) {
    const pesos = cardinalEnPalabras(l);
    if (pesos !== null) monto = pesos * 100;
  }
  if (monto === null) {
    l.volver(inicio);
    return null;
  }
  if (l.pos === despuesDeAprox) {
    l.volver(inicio);
    return null;
  }
  const moneda = l.ver();
  if (moneda !== undefined && MONEDA.has(moneda)) {
    l.pos++;
    // A2: "85 pesos con 50 centavos". Exige "pesos" antes, un monto sin decimales, N 1–99 y "centavos".
    if ((moneda === 'pesos' || moneda === 'peso') && monto % 100 === 0) {
      const antesDeCon = l.marca();
      if (l.palabra('con')) {
        const centavos = leerEntero(l, 99);
        if (centavos !== null && l.palabra('centavos', 'centavo')) monto += centavos;
        else l.volver(antesDeCon);
      }
    }
  }
  if (APROX_DESPUES.some((s) => l.secuencia(...s))) aproximado = true;
  return { monto, aproximado };
}

/** Entero pequeño (1..`max`) en dígitos o en palabras: meses, partes, días. `null` sin mover el cursor si no hay. */
export function leerEntero(l: Lector, max: number): number | null {
  const inicio = l.marca();
  const token = l.ver();
  if (token === undefined) return null;
  let valor: number | null = null;
  if (/^\d{1,3}$/.test(token)) {
    valor = Number(token);
    l.pos++;
  } else {
    valor = grupoEnPalabras(l);
    if (valor !== null && esPalabraNumero(l.ver())) valor = null;
  }
  if (valor === null || valor < 1 || valor > max) {
    l.volver(inicio);
    return null;
  }
  return valor;
}

const ORDINALES: Readonly<Record<string, number>> = {
  primero: 1,
  primer: 1,
  primera: 1,
  segundo: 2,
  segunda: 2,
  tercero: 3,
  tercer: 3,
  tercera: 3,
  cuarto: 4,
  cuarta: 4,
  quinto: 5,
  quinta: 5,
  sexto: 6,
  sexta: 6,
  septimo: 7,
  septima: 7,
  octavo: 8,
  octava: 8,
  noveno: 9,
  novena: 9,
  decimo: 10,
  decima: 10,
};

/** Ordinal ("el cuarto") o "número N" / "N". */
export function leerOrdinal(l: Lector, max: number): number | null {
  const inicio = l.marca();
  const token = l.ver();
  const ordinal = token === undefined ? undefined : ORDINALES[token];
  if (ordinal !== undefined && ordinal <= max) {
    l.pos++;
    return ordinal;
  }
  l.palabra('numero');
  const n = leerEntero(l, max);
  if (n === null) l.volver(inicio);
  return n;
}
