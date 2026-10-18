import { describe, expect, it } from 'vitest';
import { textoAvisoCaptura } from './captura';

describe('textoAvisoCaptura', () => {
  it('describe cuántos movimientos hay y dónde verlos', () => {
    expect(textoAvisoCaptura(1)).toBe('1 movimiento nuevo. Revísalo en Movimientos.');
    expect(textoAvisoCaptura(3)).toBe('3 movimientos nuevos. Revísalos en Movimientos.');
    expect(textoAvisoCaptura(0)).toBe('');
  });
});
