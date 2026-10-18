import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';

describe('ErrorDominio', () => {
  it('conserva el literal de codigo en el tipo', () => {
    const e = new ErrorDominio('fecha_invalida', 'fecha inválida: 2026-13-01');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ErrorDominio);
    expect(e.name).toBe('ErrorDominio');
    const codigo: 'fecha_invalida' = e.codigo;
    expect(codigo).toBe('fecha_invalida');
  });
});
