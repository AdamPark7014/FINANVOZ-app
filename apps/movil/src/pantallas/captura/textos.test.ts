import { describe, expect, it } from 'vitest';
import {
  PERMISO_DENEGADO,
  PERMISO_INSTRUCCION,
  TEXTO_CAPTURAS_POR_REVISAR_VACIO,
  etiquetaPermisoCaptura,
  etiquetaVacioCapturasPorRevisar,
} from './textos';

describe('captura/textos', () => {
  it('vacío y permisos cumplen 02 §14 (sin exclamación)', () => {
    for (const copy of [TEXTO_CAPTURAS_POR_REVISAR_VACIO, PERMISO_INSTRUCCION, PERMISO_DENEGADO]) {
      expect(copy).not.toMatch(/!/);
    }
  });

  it('permiso de notificaciones nombra Ajustes del teléfono y Finanvoz', () => {
    expect(PERMISO_INSTRUCCION).toMatch(/Ajustes del teléfono/);
    expect(PERMISO_INSTRUCCION).toMatch(/Finanvoz/);
    expect(PERMISO_DENEGADO).toMatch(/Ajustes del teléfono/);
  });

  it('etiquetas TalkBack incluyen el título de sección', () => {
    expect(etiquetaVacioCapturasPorRevisar()).toMatch(/Capturas por revisar/);
    expect(etiquetaPermisoCaptura(false)).toMatch(/Acceso a notificaciones/);
  });
});
