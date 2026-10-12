import { describe, expect, it } from 'vitest';
import { formatearPesos, leerPesos } from './formato';

describe('leerPesos', () => {
  it.each([
    ['20000', 2000000],
    ['20,000', 2000000],
    ['$ 1,099.9', 109990],
    ['1500.05', 150005],
    ['0', 0],
    ['1,234,567.89', 123456789],
  ])('%s → %i', (texto, esperado) => expect(leerPesos(texto)).toBe(esperado));

  it.each(['', 'abc', '1.234', '-5', '1e5', '12,34'])('rechaza %j', (texto) =>
    expect(leerPesos(texto)).toBeNull(),
  );
});

describe('formatearPesos', () => {
  it.each([
    [150000, '$1,500'],
    [109990, '$1,099.90'],
    [0, '$0'],
    [-37400, '−$374'],
    [296294400, '$2,962,944'],
  ])('%i → %s', (c, esperado) => expect(formatearPesos(c)).toBe(esperado));
});
