import {
  PISTA_OCULTAR_MONTOS,
  PISTA_PREVIA,
  PISTA_PREVIA_OCULTA,
  TEXTO_INSTRUCCION,
} from './widget-textos';

describe('widget-textos (TalkBack, 02 §21)', () => {
  it('instrucciones usan tuteo (imperativo)', () => {
    expect(TEXTO_INSTRUCCION).toMatch(/mantén presionado/i);
    expect(TEXTO_INSTRUCCION).not.toMatch(/\busted\b/i);
  });

  it('pistas de previa mencionan tu saldo; ninguna usa exclamación', () => {
    expect(PISTA_PREVIA).toMatch(/\btu\b/i);
    expect(PISTA_PREVIA_OCULTA).toMatch(/\btu\b/i);
    for (const pista of [PISTA_PREVIA, PISTA_PREVIA_OCULTA, PISTA_OCULTAR_MONTOS]) {
      expect(pista).not.toMatch(/!/);
    }
  });
});
