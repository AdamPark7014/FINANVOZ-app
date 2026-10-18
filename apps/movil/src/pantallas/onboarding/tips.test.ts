import { describe, expect, it } from 'vitest';
import {
  TIP_CAPTURA_AHORA_NO,
  TIP_COLCHON_SIN_POR_AHORA,
  TIP_CONSENTIMIENTO,
  TIP_CUENTAS_MINIMO,
  TIP_INGRESO_SALTAR,
  TIP_PAGOS_SALTAR,
} from './tips';

const TODOS_LOS_TIPS = [
  TIP_CONSENTIMIENTO,
  TIP_INGRESO_SALTAR,
  TIP_CUENTAS_MINIMO,
  TIP_PAGOS_SALTAR,
  TIP_CAPTURA_AHORA_NO,
  TIP_COLCHON_SIN_POR_AHORA,
] as const;

describe('tips de onboarding', () => {
  it('cumplen 02 §14: sin exclamación, «por favor» ni marcadores de conflicto', () => {
    for (const tip of TODOS_LOS_TIPS) {
      expect(tip).not.toMatch(/!/);
      expect(tip).not.toMatch(/por favor/i);
      expect(tip).not.toMatch(/exitosamente/i);
      expect(tip).not.toMatch(/<<<<<<|=======|>>>>>>>/);
    }
  });

  it('TIP_CONSENTIMIENTO recuerda que nada se guarda hasta aceptar', () => {
    expect(TIP_CONSENTIMIENTO).toMatch(/tu teléfono/);
    expect(TIP_CONSENTIMIENTO).toMatch(/«Aceptar y continuar»/);
    expect(TIP_CONSENTIMIENTO).toMatch(/casilla obligatoria/);
    expect(TIP_CONSENTIMIENTO).not.toMatch(/!/);
  });

  it('TIP_CAPTURA_AHORA_NO es una frase es-MX con permiso de notificaciones y «Ahora no»', () => {
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/notificaciones/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/«Ahora no»/);
    expect(TIP_CAPTURA_AHORA_NO).toMatch(/Ajustes/);
    expect(TIP_CAPTURA_AHORA_NO).not.toMatch(/!/);
  });

  it('TIP_COLCHON_SIN_POR_AHORA es una frase es-MX con la salida «Sin colchón por ahora»', () => {
    expect(TIP_COLCHON_SIN_POR_AHORA).toMatch(/«Sin colchón por ahora»/);
    expect(TIP_COLCHON_SIN_POR_AHORA).toMatch(/Ajustes/);
    expect(TIP_COLCHON_SIN_POR_AHORA).not.toMatch(/!/);
  });

  it('TIP_INGRESO_SALTAR menciona «Saltar por ahora» y Ajustes › Ingreso', () => {
    expect(TIP_INGRESO_SALTAR).toMatch(/«Saltar por ahora»/);
    expect(TIP_INGRESO_SALTAR).toMatch(/Ajustes › Ingreso/);
  });

  it('TIP_CUENTAS_MINIMO menciona «Continuar» y Cuentas', () => {
    expect(TIP_CUENTAS_MINIMO).toMatch(/«Continuar»/);
    expect(TIP_CUENTAS_MINIMO).toMatch(/Cuentas/);
    expect(TIP_CUENTAS_MINIMO).not.toMatch(/d[eé]bito/i);
  });

  it('TIP_PAGOS_SALTAR menciona «Saltar por ahora»', () => {
    expect(TIP_PAGOS_SALTAR).toMatch(/«Saltar por ahora»/);
    expect(TIP_PAGOS_SALTAR).toMatch(/Hoy/);
  });
});
