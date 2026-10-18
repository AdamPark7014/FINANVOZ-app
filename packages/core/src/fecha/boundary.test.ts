import { describe, expect, it } from 'vitest';
import { esFecha } from '../fecha';

describe('PlainDate YYYY-MM-DD · borde', () => {
  it('rechaza 29-feb cuando el año no es bisiesto', () => {
    expect(esFecha('2023-02-29')).toBe(false);
  });
});
