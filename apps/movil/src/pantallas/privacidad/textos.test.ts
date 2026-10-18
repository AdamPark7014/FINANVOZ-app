import { describe, expect, it } from 'vitest';
import {
  etiquetaAccesibleIntroPrivacidad,
  etiquetaIntroReconsentimiento,
  etiquetaLineaGuardado,
  guardadoVacio,
  INTRO_PRIVACIDAD,
  lineasGuardado,
  lineaVersionTerminos,
  PALABRA_BORRAR,
  textoCaptura,
  textoConsentimiento,
  TEXTO_SIN_CONSENTIMIENTO,
  type ConteosGuardado,
} from './textos';

const vacio: ConteosGuardado = {
  cuentas: 0,
  tarjetas: 0,
  movimientos: 0,
  personas: 0,
  textosNotificacion: 0,
  frasesPorInterpretar: 0,
};

describe('textos del centro de privacidad', () => {
  it('guardadoVacio y lineasGuardado reflejan conteos en español de México', () => {
    expect(guardadoVacio(vacio)).toBe(true);
    expect(lineasGuardado({ ...vacio, cuentas: 1, movimientos: 2 })).toEqual([
      '1 cuenta',
      '0 tarjetas',
      '2 movimientos',
      '0 personas a quienes prestas o que te deben',
      '0 avisos de banco (se borran a los 30 días)',
      '0 frases esperando internet',
    ]);
  });

  it('textoCaptura y textoConsentimiento usan copy fijo de la pantalla', () => {
    expect(textoCaptura(false, 0)).toMatch(/apagada/);
    expect(textoCaptura(true, 1)).toMatch(/1 app de banco/);
    expect(textoConsentimiento('2026-10-m8', '2026-10-11')).toMatch(/2026-10-m8/);
    expect(textoConsentimiento('2026-10-m8', '2026-10-11')).toMatch(/11 oct/);
    expect(TEXTO_SIN_CONSENTIMIENTO).toMatch(/Todavía no consta/);
  });

  it('PALABRA_BORRAR y versión de términos son estables para pruebas de UI', () => {
    expect(PALABRA_BORRAR).toBe('BORRAR');
    expect(lineaVersionTerminos('2026-10-m8')).toBe('Versión 2026-10-m8');
  });

  it('etiquetas habladas para intro y conteos del centro', () => {
    expect(etiquetaAccesibleIntroPrivacidad()).toBe(INTRO_PRIVACIDAD);
    expect(etiquetaIntroReconsentimiento('2026-10-m8')).toContain('2026-10-m8');
    expect(etiquetaLineaGuardado('2 movimientos')).toMatch(/dos movimientos/i);
  });
});
