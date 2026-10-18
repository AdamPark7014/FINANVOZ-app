import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  cifraEnPalabras,
  enteroEnPalabras,
  etiquetaHablada,
  formatearCentavos,
  leerPesos,
  type ModoCifra,
} from './formato';

describe('formatearCentavos', () => {
  it.each([
    [150000, 'auto', '$1,500'],
    [150000, 'centavos', '$1,500.00'],
    [109990, 'auto', '$1,099.90'],
    [21499, 'pesos', '$214'],
    [21400, 'pesos', '$214'],
    [0, 'auto', '$0'],
    [5, 'auto', '$0.05'],
    [-37400, 'auto', '−$374'],
    [-350, 'pesos', '−$4'],
    [99, 'pesos', '$0'],
    [123456789012, 'centavos', '$1,234,567,890.12'],
  ] as const)('%i en modo %s → %s', (c, modo, esperado) => {
    expect(formatearCentavos(c, modo)).toBe(esperado);
  });

  it('no formatea lo que no es un entero de centavos', () => {
    expect(formatearCentavos(1.5)).toBe('—');
  });
});

describe('leerPesos', () => {
  it.each([
    ['1500', 150000],
    ['1,500', 150000],
    ['$1,099.9', 109990],
    ['$ 1,099.90', 109990],
    ['.5', 50],
    ['20,000', 2000000],
    ['0.01', 1],
    ['25.', 2500],
  ])('"%s" → %i', (texto, esperado) => {
    expect(leerPesos(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1.234', '1,50', '-5', '1e3', '.'])('"%s" no es monto', (texto) => {
    expect(leerPesos(texto)).toBeNull();
  });

  it('ida y vuelta con el formato de centavos, sin flotantes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999_999_999 }), (c) => {
        expect(leerPesos(formatearCentavos(c, 'centavos'))).toBe(c);
      }),
    );
  });
});

describe('palabras para TalkBack', () => {
  it.each([
    [0, 'cero'],
    [1, 'uno'],
    [15, 'quince'],
    [21, 'veintiuno'],
    [45, 'cuarenta y cinco'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [214, 'doscientos catorce'],
    [1000, 'mil'],
    [1099, 'mil noventa y nueve'],
    [21000, 'veintiún mil'],
    [1_000_000, 'un millón'],
    [2_500_300, 'dos millones quinientos mil trescientos'],
  ])('%i → %s', (n, esperado) => {
    expect(enteroEnPalabras(n)).toBe(esperado);
  });

  it.each([
    [21400, 'auto', 'doscientos catorce pesos'],
    [21499, 'pesos', 'doscientos catorce pesos'],
    [100, 'auto', 'un peso'],
    [2100, 'auto', 'veintiún pesos'],
    [109990, 'auto', 'mil noventa y nueve pesos con noventa centavos'],
    [101, 'auto', 'un peso con un centavo'],
    [-37400, 'auto', 'menos trescientos setenta y cuatro pesos'],
    [100_000_000, 'auto', 'un millón de pesos'],
  ] as const)('%i (%s) → %s', (c, modo, esperado) => {
    expect(cifraEnPalabras(c, modo)).toBe(esperado);
  });
});

describe('etiquetaHablada (02-UX §15: cada cifra dentro de una frase se lee en palabras)', () => {
  it.each([
    [
      'Faltan $315. Lo repartí según tus gastos en efectivo:',
      'Faltan trescientos quince pesos. Lo repartí según tus gastos en efectivo:',
    ],
    [
      'Deberías traer $1,140 en efectivo. ¿Cuánto traes?',
      'Deberías traer mil ciento cuarenta pesos en efectivo. ¿Cuánto traes?',
    ],
    ['Coca $25 · ayer', 'Coca veinticinco pesos · ayer'],
    [
      'Paga $1,099.90 para no generar intereses.',
      'Paga mil noventa y nueve pesos con noventa centavos para no generar intereses.',
    ],
    ['Vas −$374', 'Vas menos trescientos setenta y cuatro pesos'],
    ['$1,500 y $0.05', 'mil quinientos pesos y cero pesos con cinco centavos'],
    ['Sin cifras ni 4 días', 'Sin cifras ni 4 días'],
  ])('%s', (texto, esperado) => {
    expect(etiquetaHablada(texto)).toBe(esperado);
  });

  it('propiedad: toda cifra de formatearCentavos se lee como cifraEnPalabras, sin "$" ni dígitos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e11, max: 1e11 }),
        fc.constantFrom<ModoCifra>('auto', 'centavos', 'pesos'),
        (c, modo) => {
          const texto = formatearCentavos(c, modo);
          const negativo = texto.startsWith('−');
          const valor = leerPesos(texto.replace('−', '')) ?? 0;
          const hablado = etiquetaHablada(`Total ${texto}.`);
          expect(hablado).not.toMatch(/\$|\d/);
          expect(hablado).toBe(`Total ${negativo ? 'menos ' : ''}${cifraEnPalabras(valor)}.`);
        },
      ),
    );
  });
});
