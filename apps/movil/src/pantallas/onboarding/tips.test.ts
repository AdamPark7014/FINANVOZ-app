import { describe, expect, it } from 'vitest';
import { TIP_CAPTURA_AHORA_NO, TIP_COLCHON_SIN_POR_AHORA, TIP_CONSENTIMIENTO } from './tips';

describe('tips de onboarding', () => {
<<<<<<< Updated upstream
  it('TIP_CONSENTIMIENTO recuerda que nada se guarda hasta aceptar', () => {
    expect(TIP_CONSENTIMIENTO).toMatch(/Aceptar y continuar/);
    expect(TIP_CONSENTIMIENTO).toMatch(/casilla obligatoria/);
    expect(TIP_CONSENTIMIENTO).not.toMatch(/!/);
  });

  it('TIP_CAPTURA_AHORA_NO es una frase es-MX con la salida «Ahora no»', () => {
=======
  it('TIP_CAPTURA_AHORA_NO es una frase es-MX con permiso de notificaciones y «Ahora no»', () => {
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/notificaciones/);
>>>>>>> Stashed changes
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
