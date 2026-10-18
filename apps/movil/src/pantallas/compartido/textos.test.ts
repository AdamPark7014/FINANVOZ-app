import {
  etiquetaVacioCompartidos,
  TEXTO_COMPARTIDOS_VACIO,
  TITULO_GASTOS_COMPARTIDOS,
} from './textos';

describe('textos de compartidos (02 §27)', () => {
  it('etiqueta TalkBack del vacío incluye título de pantalla', () => {
    expect(etiquetaVacioCompartidos()).toBe(`${TITULO_GASTOS_COMPARTIDOS}. ${TEXTO_COMPARTIDOS_VACIO}`);
  });
});
