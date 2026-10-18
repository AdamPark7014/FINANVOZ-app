import { describe, expect, it } from 'vitest';
import { TIP_CAPTURA_AHORA_NO, TIP_COLCHON_SIN_POR_AHORA } from './tips';

describe('tips de onboarding', () => {
  it('TIP_CAPTURA_AHORA_NO es una frase es-MX con la salida «Ahora no»', () => {
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ahora no/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ajustes/);
    expect(TIP_CAPTURA_AHORA_NO).not.toMatch(/!/);
  });

  it('TIP_COLCHON_SIN_POR_AHORA es una frase es-MX con la salida «Sin colchón por ahora»', () => {
    expect(TIP_COLCHON_SIN_POR_AHORA).toMatch(/Sin colchón por ahora/);
    expect(TIP_COLCHON_SIN_POR_AHORA).toMatch(/Ajustes/);
    expect(TIP_COLCHON_SIN_POR_AHORA).not.toMatch(/!/);
  });
});
