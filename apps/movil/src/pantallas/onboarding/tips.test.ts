import { describe, expect, it } from 'vitest';
import { TIP_CAPTURA_AHORA_NO } from './tips';

describe('tips de onboarding', () => {
  it('TIP_CAPTURA_AHORA_NO es una frase es-MX con la salida «Ahora no»', () => {
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ahora no/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ajustes/);
    expect(TIP_CAPTURA_AHORA_NO).not.toMatch(/!/);
  });
});
