import { describe, expect, it } from 'vitest';
import {
  PERMISO_DENEGADO,
  PERMISO_INSTRUCCION,
  PISTA_YA_REGISTRE_AVISO,
  TEXTO_CAPTURAS_POR_REVISAR_VACIO,
  etiquetaCuerpoReactivarCaptura,
  etiquetaIntroCapturasPorRevisar,
  etiquetaPermisoCaptura,
  TITULO_REACTIVAR_CAPTURA,
  etiquetaVacioCapturasPorRevisar,
  PISTA_AHORA_NO_ACTIVAR_CAPTURA,
  PISTA_DESCARTAR_REACTIVAR_CAPTURA,
  PISTA_NO_OTRO_DUPLICADO,
  PISTA_SI_MISMO_DUPLICADO,
  etiquetaDetallePreguntaCaptura,
  etiquetaResumenCapturaActiva,
} from './textos';

describe('captura/textos', () => {
  it('vacío y permisos cumplen 02 §14 (sin exclamación)', () => {
    for (const copy of [
      TEXTO_CAPTURAS_POR_REVISAR_VACIO,
      PERMISO_INSTRUCCION,
      PERMISO_DENEGADO,
      PISTA_YA_REGISTRE_AVISO,
      PISTA_AHORA_NO_ACTIVAR_CAPTURA,
      PISTA_DESCARTAR_REACTIVAR_CAPTURA,
      PISTA_SI_MISMO_DUPLICADO,
      PISTA_NO_OTRO_DUPLICADO,
    ]) {
      expect(copy).not.toMatch(/!/);
    }
  });

  it('etiquetas TalkBack de preguntas dictan cifras en palabras', () => {
    const titulo = '¿De dónde salió el pago de $4,200 a tu Oro?';
    const detalle = 'Llegó el vie 9 y no vi de qué cuenta salió.';
    expect(etiquetaDetallePreguntaCaptura(titulo, detalle)).toMatch(/cuatro mil doscientos pesos/);
    expect(etiquetaResumenCapturaActiva(['Banco A'])).toMatch(/Por revisar/);
  });

  it('permiso de notificaciones nombra Ajustes del teléfono y Finanvoz', () => {
    expect(PERMISO_INSTRUCCION).toMatch(/Ajustes del teléfono/);
    expect(PERMISO_INSTRUCCION).toMatch(/Finanvoz/);
    expect(PERMISO_DENEGADO).toMatch(/Ajustes del teléfono/);
  });

  it('etiquetas TalkBack incluyen el título de sección', () => {
    expect(etiquetaVacioCapturasPorRevisar()).toMatch(/Capturas por revisar/);
    expect(etiquetaIntroCapturasPorRevisar()).toMatch(/Capturas por revisar/);
    expect(etiquetaCuerpoReactivarCaptura()).toMatch(new RegExp(TITULO_REACTIVAR_CAPTURA));
    expect(etiquetaPermisoCaptura(false)).toMatch(/Acceso a notificaciones/);
    expect(etiquetaPermisoCaptura(false)).toMatch(/ajustes restringidos/);
    expect(etiquetaPermisoCaptura(true)).toMatch(/Ajustes del teléfono/);
  });
});
