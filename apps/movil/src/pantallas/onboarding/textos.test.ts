import { describe, expect, it } from 'vitest';
import {
  AYUDA_BIENVENIDA,
  AYUDA_COLCHON_ONB,
  AYUDA_PAGOS_FIJOS,
  BTN_ACEPTAR_CONTINUAR,
  BTN_SIN_COLCHON_POR_AHORA,
  CASILLA_DATOS_FINANCIEROS,
  CASILLA_ESTADISTICAS_OPCIONAL,
  CUERPO_BIENVENIDA,
  ERROR_GUARDAR,
  ERROR_PAGO_FIJO_INCOMPLETO,
  etiquetaProgresoOnboarding,
  etiquetaTipOnboarding,
  PASOS_ONBOARDING,
  PISTA_MARCAR_CASILLA_DATOS,
  TITULO_BIENVENIDA,
  TITULO_COLCHON,
  TITULO_CONSENTIMIENTO,
  TIP_CAPTURA_AHORA_NO,
  TIP_COLCHON_SIN_POR_AHORA,
  TIP_CUENTAS_MINIMO,
  TIP_INGRESO_SALTAR,
  TIP_PAGOS_SALTAR,
  TITULO_CUENTAS,
  TITULO_INGRESO,
  TITULO_PAGOS_FIJOS,
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
      TITULO_PAGOS_FIJOS,
      AYUDA_PAGOS_FIJOS,
      ERROR_PAGO_FIJO_INCOMPLETO,
      TITULO_COLCHON,
      AYUDA_COLCHON_ONB,
      BTN_SIN_COLCHON_POR_AHORA,
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

  it('TalkBack del consejo antepone «Consejo»', () => {
    expect(etiquetaTipOnboarding(TIP_INGRESO_SALTAR)).toBe(`Consejo: ${TIP_INGRESO_SALTAR}`);
  });

  it('O3 y O4 cumplen 02 §14: tuteo y sin exclamación', () => {
    for (const texto of [TITULO_INGRESO, TIP_INGRESO_SALTAR, TITULO_CUENTAS, TIP_CUENTAS_MINIMO]) {
      expect(texto).not.toMatch(/!/);
      expect(texto).not.toMatch(/por favor/i);
    }
    expect(TIP_INGRESO_SALTAR).toMatch(/«Saltar por ahora»/);
    expect(TIP_CUENTAS_MINIMO).toMatch(/«Continuar»/);
  });

  it('O5 y O7 tips de saltar cumplen 02 §14', () => {
    for (const texto of [TIP_PAGOS_SALTAR, TIP_COLCHON_SIN_POR_AHORA]) {
      expect(texto).not.toMatch(/!/);
      expect(texto).not.toMatch(/por favor/i);
    }
    expect(TIP_PAGOS_SALTAR).toMatch(/«Saltar por ahora»/);
    expect(TIP_COLCHON_SIN_POR_AHORA).toMatch(/«Sin colchón por ahora»/);
  });
});
