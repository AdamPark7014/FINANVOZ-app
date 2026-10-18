import {
  etiquetaProximoPagoIngreso,
  ETIQUETA_PROXIMO_PAGO,
  PISTA_CAMBIAR_INGRESO,
  PISTA_CONFIGURAR_INGRESO,
  PISTA_GUARDAR,
} from './ingreso-textos';

describe('ingreso-textos (TalkBack, 02 §12)', () => {
  it('próximo pago antepone la etiqueta a la fecha', () => {
    expect(etiquetaProximoPagoIngreso('jue 15 oct 2026')).toBe(
      `${ETIQUETA_PROXIMO_PAGO}: jue 15 oct 2026`,
    );
  });

  it('pistas TalkBack usan tuteo y no exclamación', () => {
    expect(PISTA_CAMBIAR_INGRESO).toMatch(/\bte\b/i);
    expect(PISTA_CONFIGURAR_INGRESO).toMatch(/\bte\b/i);
    expect(PISTA_GUARDAR).toMatch(/puedes gastar/i);
    for (const pista of [PISTA_CAMBIAR_INGRESO, PISTA_CONFIGURAR_INGRESO, PISTA_GUARDAR]) {
      expect(pista).not.toMatch(/!/);
    }
  });
});
