import { describe, expect, it } from 'vitest';
import {
  BTN_RECONSENT_SOLO_LECTURA,
  CASILLA_RECONSENT_DATOS,
  introReconsentimiento,
  TIP_AVISO_PRIVACIDAD,
  TIP_SOLO_LECTURA,
  TITULO_RECONSENTIMIENTO,
} from './textos';

describe('copy reconsentimiento y aviso-privacidad (02 §14)', () => {
  it('el título y la intro explican solo lectura y movimientos nuevos', () => {
    expect(TITULO_RECONSENTIMIENTO).toMatch(/aviso de privacidad/i);
    const intro = introReconsentimiento('2026-10-m8');
    expect(intro).toContain('2026-10-m8');
    expect(intro).toMatch(/solo lectura/i);
    expect(intro).toMatch(/movimientos nuevos/i);
    expect(intro).not.toMatch(/!/);
  });

  it('la casilla obligatoria menciona la versión del aviso y datos financieros', () => {
    expect(CASILLA_RECONSENT_DATOS).toMatch(/versión del aviso/i);
    expect(CASILLA_RECONSENT_DATOS).toMatch(/datos financieros/i);
  });

  it('tips de solo lectura y aviso completo no usan exclamación', () => {
    for (const tip of [TIP_SOLO_LECTURA, TIP_AVISO_PRIVACIDAD]) {
      expect(tip).not.toMatch(/!/);
      expect(tip).not.toMatch(/por favor/i);
    }
    expect(BTN_RECONSENT_SOLO_LECTURA).toMatch(/solo lectura/i);
  });
});
