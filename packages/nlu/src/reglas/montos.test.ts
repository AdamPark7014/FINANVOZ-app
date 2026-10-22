import { describe, expect, it } from 'vitest';
import { cargarContexto } from '../eval/fixtures';
import { interpretarReglas } from './index';
import { Lector } from './lector';
import { leerMonto } from './montos';
import { tokenizar } from './tokens';

/** Monto que consume la frase completa (en centavos), o `null`. */
function leer(texto: string): number | null {
  const l = new Lector(tokenizar(texto));
  const lectura = leerMonto(l);
  return lectura && l.fin ? lectura.monto : null;
}

// Generador de cardinales en palabras (es-MX) para la ida y vuelta: el mismo criterio que `enteroEnPalabras` de la
// app (apps/movil/src/ui/formato.ts), que el paquete no puede importar. "uno" se apocopa ante "mil" y "pesos".
const UNIDADES = [
  '',
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
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function menorQueMil(n: number): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c] ?? '');
  if (r > 0 && r < 30) partes.push(UNIDADES[r] ?? '');
  else if (r >= 30) {
    const d = Math.floor(r / 10);
    const u = r % 10;
    partes.push(u === 0 ? (DECENAS[d] ?? '') : `${DECENAS[d] ?? ''} y ${UNIDADES[u] ?? ''}`);
  }
  return partes.join(' ');
}

const apocopar = (texto: string) => texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

/** n en palabras, 1 ≤ n < 1,000,000. */
function enteroEnPalabras(n: number): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${apocopar(menorQueMil(miles))} mil`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(' ');
}

describe('A0 · ida y vuelta de cardinales en palabras', () => {
  it('el generador escribe lo que dice la app', () => {
    expect(enteroEnPalabras(31_910)).toBe('treinta y un mil novecientos diez');
    expect(enteroEnPalabras(21_000)).toBe('veintiún mil');
    expect(enteroEnPalabras(101_001)).toBe('ciento un mil uno');
    expect(enteroEnPalabras(31)).toBe('treinta y uno');
  });

  it('todo n < 1,000,000 dicho en palabras se lee como n', { timeout: 120_000 }, () => {
    const fallas: number[] = [];
    for (let n = 1; n < 1_000_000; n++) {
      if (leer(enteroEnPalabras(n)) !== n * 100) fallas.push(n);
      if (fallas.length > 5) break;
    }
    expect(fallas).toEqual([]);
  });

  it('con "pesos" detrás ("treinta y un pesos", "veintiún mil pesos")', { timeout: 120_000 }, () => {
    const fallas: number[] = [];
    for (let n = 2; n < 1_000_000; n += 7) {
      if (leer(`${apocopar(enteroEnPalabras(n))} pesos`) !== n * 100) fallas.push(n);
      if (fallas.length > 5) break;
    }
    expect(fallas).toEqual([]);
    expect(leer('treinta y un pesos')).toBe(3_100);
    expect(leer('treinta y un mil novecientos diez')).toBe(3_191_000);
    expect(leer('cuarenta y una mil')).toBe(4_100_000);
  });

  it('"un" después de "y" sigue sin ser unidad si no viene "mil" o la moneda', () => {
    expect(leer('treinta y un')).toBeNull();
    expect(leer('treinta y un refresco')).toBeNull();
    const { contexto } = cargarContexto();
    // "y un refresco" sigue siendo otra parte del gasto, no el 31.
    expect(interpretarReglas('tacos de treinta y un refresco de 20', contexto)).toMatchObject({
      intencion: 'registrar',
      movimientos: [{ monto: 3_000 }, { monto: 2_000 }],
    });
    expect(leer('un peso')).toBeNull();
  });
});

describe('A1 · "N mil M"', () => {
  it('M en dígitos o en palabras', () => {
    expect(leer('8 mil 500')).toBe(850_000);
    expect(leer('8 mil quinientos')).toBe(850_000);
    expect(leer('8 mil quinientos cincuenta')).toBe(855_000);
    expect(leer('8 mil 5')).toBe(800_500);
    expect(leer('999 mil 999')).toBe(99_999_900);
    expect(leer('$8 mil 500 pesos')).toBe(850_000);
  });

  it('otra cifra, decimales, comas o un "un" suelto → null', () => {
    for (const texto of [
      '8 mil 500 600',
      '8 mil 500 quinientos',
      '8 mil quinientos 20',
      '8 mil 1,500',
      '8 mil 50.5',
      '8 mil 0',
      '8 mil 1000',
      '1.5 mil 200',
      '1,500 mil 200',
      '8 mil un',
      '8 mil mil',
    ]) {
      expect(leer(texto), texto).toBeNull();
    }
    expect(leer('8 mil')).toBe(800_000);
    expect(leer('1.5 mil')).toBe(150_000);
  });

  it('"millón" y "y medio" siguen en null', () => {
    for (const texto of ['un millón', '1 millón', 'millón', 'ocho mil y medio', '8 mil y medio']) {
      expect(leer(texto), texto).toBeNull();
    }
  });
});

describe('A2 · "MONTO pesos con N centavos"', () => {
  it('suma los centavos', () => {
    expect(leer('85 pesos con 50 centavos')).toBe(8_550);
    expect(leer('ochenta y cinco pesos con cincuenta centavos')).toBe(8_550);
    expect(leer('1 peso con 1 centavo')).toBe(101);
    expect(leer('como 85 pesos con 50 centavos')).toBe(8_550);
  });

  it('sin "pesos", sin "centavos", con decimales o con más de 99 centavos → no los toma', () => {
    for (const texto of [
      '85 con 50 centavos',
      '85 pesos con 50',
      '85.50 pesos con 50 centavos',
      '85 pesos con 100 centavos',
      '85 pesos con 0 centavos',
      '85 varos con 50 centavos',
    ]) {
      expect(leer(texto), texto).toBeNull();
    }
    const { contexto } = cargarContexto();
    expect(interpretarReglas('tacos 85 pesos con la Nu', contexto)).toMatchObject({
      intencion: 'registrar',
      movimientos: [{ monto: 8_500, origen: { tipo: 'credito', alias: 'nu' } }],
    });
  });
});
