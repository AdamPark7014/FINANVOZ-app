import { describe, expect, it } from 'vitest';
import {
  AYUDA_BIENVENIDA,
  BTN_ACEPTAR_CONTINUAR,
  CASILLA_DATOS_FINANCIEROS,
  CASILLA_ESTADISTICAS_OPCIONAL,
  CUERPO_BIENVENIDA,
  ERROR_GUARDAR,
  etiquetaProgresoOnboarding,
  PASOS_ONBOARDING,
  PISTA_MARCAR_CASILLA_DATOS,
  TITULO_BIENVENIDA,
  TITULO_CONSENTIMIENTO,
  TITULO_INGRESO,
  textoProgresoOnboarding,
} from './textos';

describe('textos de onboarding', () => {
  it('O1 y O2 cumplen 02 §14: tuteo y sin exclamación', () => {
    for (const texto of [
      TITULO_BIENVENIDA,
      AYUDA_BIENVENIDA,
      CUERPO_BIENVENIDA,
      ERROR_GUARDAR,
      TITULO_CONSENTIMIENTO,
      BTN_ACEPTAR_CONTINUAR,
      CASILLA_DATOS_FINANCIEROS,
      CASILLA_ESTADISTICAS_OPCIONAL,
      PISTA_MARCAR_CASILLA_DATOS,
      TITULO_INGRESO,
    ]) {
      expect(texto).not.toMatch(/!/);
      expect(texto).not.toMatch(/por favor/i);
    }
    expect(AYUDA_BIENVENIDA).toMatch(/\btu\b/i);
  });

  it('TalkBack del progreso describe el recorrido inicial', () => {
    expect(textoProgresoOnboarding(1)).toBe('Paso 1 de 7');
    expect(PASOS_ONBOARDING).toBe(7);
    expect(etiquetaProgresoOnboarding(3)).toBe('Paso 3 de 7 del recorrido inicial');
  });
});
