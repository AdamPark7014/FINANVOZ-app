import {
  ETIQUETA_CAPTURA_APAGADA,
  ETIQUETA_CAPTURA_NO_DISPONIBLE,
  etiquetaCapturaActiva,
  textoCapturaActiva,
} from './captura-textos';

describe('captura-textos (TalkBack)', () => {
  it('etiquetaCapturaActiva lee el conteo en palabras', () => {
    expect(textoCapturaActiva(2)).toBe('Activa: leo los avisos de 2 apps de banco.');
    expect(etiquetaCapturaActiva(1)).toBe('Activa: leo los avisos de una app de banco.');
    expect(etiquetaCapturaActiva(2)).toBe('Activa: leo los avisos de dos apps de banco.');
    expect(etiquetaCapturaActiva(0)).toBe('Activa: aún no hay apps de banco en la lista.');
  });

  it('estados apagada y no disponible tienen etiqueta hablada', () => {
    expect(ETIQUETA_CAPTURA_APAGADA).toMatch(/apagada/i);
    expect(ETIQUETA_CAPTURA_NO_DISPONIBLE).toMatch(/no disponible/i);
  });
});
