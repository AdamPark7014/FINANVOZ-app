import { describe, expect, it } from 'vitest';
import { etiquetaBotonElegirMovimiento, TITULO_DUPLICADOS, TITULO_ELEGIR_MOVIMIENTO } from './textos';

describe('principal/textos · interpretación', () => {
  it('títulos de elegir movimiento en tuteo', () => {
    expect(TITULO_ELEGIR_MOVIMIENTO.corregir).toMatch(/\?$/);
    expect(TITULO_DUPLICADOS).toMatch(/repetido/i);
  });

  it('botón de anular dice Borrar', () => {
    expect(etiquetaBotonElegirMovimiento('anular')).toBe('Borrar');
    expect(etiquetaBotonElegirMovimiento('corregir')).toBe('Guardar');
  });
});
