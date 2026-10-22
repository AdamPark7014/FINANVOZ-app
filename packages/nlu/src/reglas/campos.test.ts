import { describe, expect, it } from 'vitest';
import { interpretarIngresoDicho, interpretarMonto, interpretarPagoFijoDicho } from './campos';

describe('interpretarMonto (campo de monto dictado, 06 §9.4)', () => {
  it.each([
    ['mil quinientos', 150_000],
    ['1.5k', 150_000],
    ['quinientos cincuenta pesos', 55_000],
    ['$1,250.50', 125_050],
    ['1500', 150_000],
    ['8 mil', 800_000],
    ['son 300', 30_000],
    ['ponle 1500 pesos', 150_000],
    ['2 mil 500', 250_000],
    ['mil 500', 150_000],
    ['doce mil', 1_200_000],
    ['cero', 0],
    ['nada', 0],
  ])('«%s» → %i centavos', (texto, centavos) => {
    expect(interpretarMonto(texto)).toEqual({ monto: centavos, aproximado: false });
  });

  it('marca los aproximados', () => {
    expect(interpretarMonto('como 500')).toEqual({ monto: 50_000, aproximado: true });
  });

  it.each(['', 'hola', 'dos cincuenta', 'un kilo de carne', '500 de tacos', 'mil 0'])(
    '«%s» no se adivina',
    (texto) => {
      expect(interpretarMonto(texto)).toBeNull();
    },
  );
});

describe('interpretarIngresoDicho (O3 dictado)', () => {
  it.each([
    ['gano doce mil cada quincena', { monto: 1_200_000, aproximado: false, frecuencia: 'quincena' }],
    [
      'me pagan 8 mil cada viernes',
      { monto: 800_000, aproximado: false, frecuencia: 'semanal', diaSemana: 5 },
    ],
    [
      'me pagan 15 mil cada mes el 30',
      { monto: 1_500_000, aproximado: false, frecuencia: 'mensual', diaMes: 30 },
    ],
    [
      'me pagan 15 mil el 15 de cada mes',
      { monto: 1_500_000, aproximado: false, frecuencia: 'mensual', diaMes: 15 },
    ],
    ['gano 20 mil al mes', { monto: 2_000_000, aproximado: false, frecuencia: 'mensual', diaMes: null }],
    ['cobro 9500 cada 14 días', { monto: 950_000, aproximado: false, frecuencia: 'catorcenal' }],
    ['5 mil a la semana', { monto: 500_000, aproximado: false, frecuencia: 'semanal', diaSemana: null }],
    ['doce mil', { monto: 1_200_000, aproximado: false, frecuencia: null }],
    ['gano como 10 mil a la quincena', { monto: 1_000_000, aproximado: true, frecuencia: 'quincena' }],
  ])('«%s»', (texto, esperado) => {
    expect(interpretarIngresoDicho(texto)).toEqual(esperado);
  });

  it.each(['', 'hola', 'gano cada quincena', 'gano 0 cada quincena', 'me pagan 8 mil cada vez que puedo'])(
    '«%s» no se adivina',
    (texto) => {
      expect(interpretarIngresoDicho(texto)).toBeNull();
    },
  );
});

describe('interpretarPagoFijoDicho (O5 dictado)', () => {
  const nada = { aproximado: false, diaMes: null, diaSemana: null, mes: null };
  it.each([
    [
      'pago 4500 de renta cada mes el 5',
      { ...nada, concepto: 'renta', monto: 450_000, frecuencia: 'mensual', diaMes: 5 },
    ],
    ['la luz son 450 cada mes', { ...nada, concepto: 'luz', monto: 45_000, frecuencia: 'mensual' }],
    ['Netflix 299 al mes', { ...nada, concepto: 'Netflix', monto: 29_900, frecuencia: 'mensual' }],
    [
      'el internet me cuesta 499 el 10 de cada mes',
      { ...nada, concepto: 'internet', monto: 49_900, frecuencia: 'mensual', diaMes: 10 },
    ],
    ['gimnasio 600', { ...nada, concepto: 'gimnasio', monto: 60_000, frecuencia: null }],
    [
      'debo pagar 1200 de la colegiatura cada quincena',
      { ...nada, concepto: 'colegiatura', monto: 120_000, frecuencia: 'quincenal' },
    ],
    [
      'el seguro del coche 8 mil cada año el 3 de marzo',
      { ...nada, concepto: 'seguro del coche', monto: 800_000, frecuencia: 'anual', diaMes: 3, mes: 3 },
    ],
    [
      'la tanda son 500 cada viernes',
      { ...nada, concepto: 'tanda', monto: 50_000, frecuencia: 'semanal', diaSemana: 5 },
    ],
  ])('«%s»', (texto, esperado) => {
    expect(interpretarPagoFijoDicho(texto)).toEqual(esperado);
  });

  it.each([
    '',
    'renta',
    'pago la renta',
    '450 cada mes',
    'la luz son 450 cuando llega',
    'pago 4500 de renta cada mes y luz 300',
  ])('«%s» no se adivina', (texto) => {
    expect(interpretarPagoFijoDicho(texto)).toBeNull();
  });
});
