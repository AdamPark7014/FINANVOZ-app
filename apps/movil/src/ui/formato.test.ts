import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  cifraEnPalabras,
  enteroEnPalabras,
  etiquetaCampoMonto,
  etiquetaEstadoVacio,
  etiquetaHablada,
  pistaCampoMonto,
  formatearCentavos,
  formatearMontoTecleado,
  leerPesos,
  tieneCifra,
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
    [-99, 'pesos', '−$1'],
    [-99, 'auto', '−$0.99'],
    [123456789012, 'centavos', '$1,234,567,890.12'],
  ] as const)('%i en modo %s → %s', (c, modo, esperado) => {
    expect(formatearCentavos(c, modo)).toBe(esperado);
  });

  it('no formatea lo que no es un entero de centavos', () => {
    expect(formatearCentavos(1.5)).toBe('—');
  });
});

describe('tieneCifra', () => {
  it.each([
    ['Faltan $315.', true],
    ['$0.05', true],
    ['Sin cifras ni 4 días', false],
    ['precio 1500', false],
    ['', false],
  ])('%s → %s', (texto, esperado) => {
    expect(tieneCifra(texto)).toBe(esperado);
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

describe('formatearMontoTecleado (H8: miles en vivo como en el resto de la app)', () => {
  /** Teclea letra por letra como el teclado numérico, con el campo formateando entre cada tecla. */
  function teclear(texto: string, inicial = ''): string {
    let valor = inicial;
    for (const letra of texto) valor = formatearMontoTecleado(valor + letra, valor);
    return valor;
  }

  it.each([
    ['13000', '13,000'],
    ['1500.5', '1,500.5'],
    ['1500.50', '1,500.50'],
    ['250', '250'],
    ['1234567', '1,234,567'],
    ['.5', '.5'],
    ['007', '7'],
  ])('teclear "%s" deja "%s"', (tecleado, visto) => {
    expect(teclear(tecleado)).toBe(visto);
    expect(leerPesos(teclear(tecleado))).toBe(leerPesos(tecleado));
  });

  it('borrar un dígito vuelve a agrupar: «13,000» → «1,300»', () => {
    expect(formatearMontoTecleado('13,00', '13,000')).toBe('1,300');
    expect(formatearMontoTecleado('1,30', '1,300')).toBe('130');
  });

  it('una coma tecleada por la persona no se reinterpreta: «12,50» nunca se vuelve mil doscientos cincuenta', () => {
    expect(teclear('12,50')).toBe('12,50');
    expect(leerPesos(teclear('12,50'))).toBeNull();
    // «1,500» escrito con su coma se respeta y sigue siendo $1,500; si ya quedó bien agrupado, el campo sigue.
    expect(teclear('1,500')).toBe('1,500');
    expect(leerPesos(teclear('1,500'))).toBe(150000);
    expect(teclear('0', '1,500')).toBe('15,000');
    // Pegar un monto ya escrito con comas también se respeta.
    expect(formatearMontoTecleado('1,500.00', '')).toBe('1,500.00');
  });

  it('lo que no es monto se deja para que el campo enseñe el error', () => {
    expect(formatearMontoTecleado('12a', '12')).toBe('12a');
    expect(formatearMontoTecleado('1.2.3', '1.2')).toBe('1.2.3');
    expect(formatearMontoTecleado('', '5')).toBe('');
  });

  it('nunca cambia el monto que lee leerPesos', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\d{1,12}(\.\d{0,2})?$/), (tecleado) => {
        expect(leerPesos(teclear(tecleado))).toBe(leerPesos(tecleado));
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

describe('etiquetaCampoMonto', () => {
  it.each([
    ['Monto', '', 'Monto en pesos'],
    ['Saldo', '1,500.50', 'Saldo en pesos, mil quinientos pesos con cincuenta centavos'],
    ['Pago $500', '500', 'Pago quinientos pesos en pesos, quinientos pesos'],
    ['Monto', '1,099.90', 'Monto en pesos, mil noventa y nueve pesos con noventa centavos'],
  ])('%s + %j → %s', (etiqueta, texto, esperado) => {
    expect(etiquetaCampoMonto(etiqueta, texto)).toBe(esperado);
  });

  it('texto inválido no inventa cifras (solo el nombre del campo)', () => {
    expect(etiquetaCampoMonto('Monto', '12.345')).toBe('Monto en pesos');
  });
});

describe('pistaCampoMonto', () => {
  it('lee la cifra de ejemplo del error de formato en palabras', () => {
    expect(pistaCampoMonto('No entendí ese monto. Escríbelo así: 1,500.50')).toBe(
      'No entendí ese monto. Escríbelo así: mil quinientos pesos con cincuenta centavos',
    );
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

describe('etiquetaEstadoVacio (TalkBack de listas vacías)', () => {
  it('«Todavía» al inicio se oye «Aún»; el resto y las cifras igual que etiquetaHablada', () => {
    expect(etiquetaEstadoVacio('Todavía no hay movimientos.')).toBe('Aún no hay movimientos.');
    expect(etiquetaEstadoVacio('Faltan $315 en el arqueo.')).toBe(
      'Faltan trescientos quince pesos en el arqueo.',
    );
    expect(etiquetaEstadoVacio('No debes nada.')).toBe('No debes nada.');
  });
});
