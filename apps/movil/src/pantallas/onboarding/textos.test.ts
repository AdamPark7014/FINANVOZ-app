import { describe, expect, it } from 'vitest';
import {
  anuncioCambioPasoOnboarding,
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
  etiquetaAyudaPasoOnboarding,
  etiquetaProgresoOnboarding,
  etiquetaProximoPagoOnboarding,
  etiquetaTipOnboarding,
  etiquetaTituloPasoOnboarding,
  ETIQUETA_PROXIMO_PAGO,
  PASOS_ONBOARDING,
  PISTA_CASILLA_ONB,
  PISTA_CHIP_ONB_ELEGIR,
  PISTA_COMPLETAR_INGRESO,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_MARCAR_CASILLA_DATOS,
  PISTA_CAPTURA_AHORA_NO,
  PISTA_ONB_CONTINUAR,
  PISTA_ONB_EMPEZAR,
  PISTA_PROGRESO_ONB,
  PISTA_TARJETA_DESPUES_ONB,
  TITULO_BIENVENIDA,
  TITULO_COLCHON,
  TITULO_CONSENTIMIENTO,
  TIP_CAPTURA_AHORA_NO,
  TIP_CONSENTIMIENTO,
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
      PISTA_LEER_AVISO_COMPLETO,
      PISTA_COMPLETAR_INGRESO,
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

  it('TalkBack O3 antepone la etiqueta al próximo pago calculado', () => {
    expect(etiquetaProximoPagoOnboarding('jue 15 oct 2026')).toBe(
      `${ETIQUETA_PROXIMO_PAGO}: jue 15 oct 2026`,
    );
  });

  it('TalkBack del progreso describe el recorrido inicial', () => {
    expect(textoProgresoOnboarding(1)).toBe('Paso 1 de 7');
    expect(PASOS_ONBOARDING).toBe(7);
    expect(etiquetaProgresoOnboarding(3)).toBe('Paso 3 de 7 del recorrido inicial');
  });

  it('TalkBack del consejo antepone «Consejo»', () => {
    expect(etiquetaTipOnboarding(TIP_INGRESO_SALTAR)).toBe(`Consejo: ${TIP_INGRESO_SALTAR}`);
    for (const tip of [
      TIP_CONSENTIMIENTO,
      TIP_PAGOS_SALTAR,
      TIP_CUENTAS_MINIMO,
      TIP_COLCHON_SIN_POR_AHORA,
      TIP_CAPTURA_AHORA_NO,
    ]) {
      expect(etiquetaTipOnboarding(tip)).toBe(`Consejo: ${tip}`);
    }
  });

  it('pistas TalkBack de Empezar y Continuar describen el recorrido', () => {
    expect(PISTA_ONB_EMPEZAR).toMatch(/recorrido/i);
    expect(PISTA_ONB_CONTINUAR).toMatch(/siguiente paso/i);
    expect(PISTA_ONB_EMPEZAR).not.toMatch(/!/);
    expect(PISTA_ONB_CONTINUAR).not.toMatch(/!/);
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

  it('O2 y O6 tips se reexportan desde textos (fuente tips.ts)', () => {
    expect(TIP_CONSENTIMIENTO).toMatch(/«Aceptar y continuar»/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/«Ahora no»/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ajustes › Captura/);
  });

  it('PISTA_CAPTURA_AHORA_NO describe el siguiente paso del recorrido', () => {
    expect(PISTA_CAPTURA_AHORA_NO).toMatch(/colchón/i);
    expect(PISTA_CAPTURA_AHORA_NO).not.toMatch(/!/);
  });

  it('pistas TalkBack de tarjeta en onboarding', () => {
    expect(PISTA_TARJETA_DESPUES_ONB).toMatch(/sin guardar/i);
  });

  it('anuncio al cambiar de paso combina progreso y título sin PII', () => {
    expect(anuncioCambioPasoOnboarding(2, TITULO_CONSENTIMIENTO)).toBe('Paso 2 de 7. Tus datos son tuyos');
    expect(anuncioCambioPasoOnboarding(1, TITULO_BIENVENIDA)).not.toMatch(/\$/);
  });

  it('pistas de progreso, chips y casilla en tuteo es-MX', () => {
    expect(PISTA_PROGRESO_ONB).toMatch(/recorrido/i);
    for (const pista of [PISTA_CHIP_ONB_ELEGIR, PISTA_CASILLA_ONB]) {
      expect(pista).not.toMatch(/!/);
      expect(pista).toMatch(/Toca/i);
    }
    expect(etiquetaTituloPasoOnboarding(TITULO_INGRESO)).toBe(TITULO_INGRESO);
    expect(etiquetaAyudaPasoOnboarding(AYUDA_BIENVENIDA)).toBe(AYUDA_BIENVENIDA);
  });
});
