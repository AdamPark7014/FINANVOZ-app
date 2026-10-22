import { describe, expect, it } from 'vitest';
import { interpretarMonto } from './campos';

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
