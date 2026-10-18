import { describe, expect, it } from 'vitest';
import { esFecha, partes } from '../fecha';
import { ErrorDominio } from '../errores';

describe('PlainDate YYYY-MM-DD · borde', () => {
  it('rechaza 29-feb cuando el año no es bisiesto', () => {
    expect(esFecha('2023-02-29')).toBe(false);
    expect(() => partes('2023-02-29')).toThrow(ErrorDominio);
  });
});
