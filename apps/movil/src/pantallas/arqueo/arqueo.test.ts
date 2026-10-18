import { describe, expect, it } from '@jest/globals';
import { ETIQUETA_MONTO_TRAES, ETIQUETA_OTRA_CANTIDAD, ETIQUETA_QUIEN_TE_PAGO } from './textos';

describe('etiquetas de campos del arqueo', () => {
  it('copy es-MX tuteo en preguntas de formulario', () => {
    expect(ETIQUETA_MONTO_TRAES).toBe('¿Cuánto traes?');
    expect(ETIQUETA_QUIEN_TE_PAGO).toBe('¿Quién te pagó?');
    expect(ETIQUETA_OTRA_CANTIDAD).toBe('Otra cantidad');
    expect(ETIQUETA_MONTO_TRAES).not.toMatch(/!/);
  });
});
