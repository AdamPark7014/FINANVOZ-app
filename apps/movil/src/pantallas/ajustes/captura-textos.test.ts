import { etiquetaCapturaActiva, textoCapturaActiva } from './captura-textos';

describe('captura-textos (TalkBack)', () => {
  it('etiquetaCapturaActiva lee el conteo en palabras', () => {
    expect(textoCapturaActiva(2)).toBe('Activa: leo los avisos de 2 apps de banco.');
    expect(etiquetaCapturaActiva(1)).toBe('Activa: leo los avisos de una app de banco.');
    expect(etiquetaCapturaActiva(2)).toBe('Activa: leo los avisos de dos apps de banco.');
  });
});
