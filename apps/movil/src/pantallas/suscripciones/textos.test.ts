import {
  etiquetaAccesibleAyudaSuscripciones,
  etiquetaAccesibleHoyApartaSuscripcion,
  etiquetaAccesibleProximoSuscripcion,
  etiquetaAccesibleResumenSuscripciones,
  TEXTO_HOY_APARTA,
  etiquetaInactivasSuscripciones,
  etiquetaVacioSuscripciones,
  mensajeAccionSuscripcion,
  mensajeNombreGuardado,
  PISTA_AYUDA,
  TEXTO_SUSCRIPCIONES_VACIO,
  TITULO_PANTALLA,
} from './textos';

describe('textos de suscripciones (02 §20)', () => {
  it('estado vacío sin cifras', () => {
    expect(TEXTO_SUSCRIPCIONES_VACIO).not.toMatch(/\$/);
  });

  it('etiqueta TalkBack del vacío incluye título de pantalla', () => {
    expect(etiquetaVacioSuscripciones()).toBe(`${TITULO_PANTALLA}. ${TEXTO_SUSCRIPCIONES_VACIO}`);
  });

  it('inactivas incluyen contexto para TalkBack', () => {
    expect(etiquetaInactivasSuscripciones('Ya no se cobran: Disney Plus')).toMatch(
      /^Suscripciones que ya no se cobran\./,
    );
  });

  it('próximo cargo con contexto TalkBack', () => {
    expect(etiquetaAccesibleProximoSuscripcion('próximo 14 oct')).toBe('Próximo cargo: próximo 14 oct');
  });

  it('compromiso activo incluye nombre en TalkBack', () => {
    expect(etiquetaAccesibleHoyApartaSuscripcion('Netflix')).toBe(`Netflix. ${TEXTO_HOY_APARTA}`);
  });

  it('ayuda en plural para varias filas', () => {
    expect(PISTA_AYUDA).toContain('Conviértelas');
    expect(etiquetaAccesibleAyudaSuscripciones()).toContain(PISTA_AYUDA);
  });

  it('resumen activas: contexto TalkBack y cifras en palabras', () => {
    const resumen = 'Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)';
    expect(etiquetaAccesibleResumenSuscripciones(resumen)).toMatch(/^Total en suscripciones activas\./);
    expect(etiquetaAccesibleResumenSuscripciones(resumen)).toMatch(/pesos/);
    expect(etiquetaAccesibleResumenSuscripciones(resumen)).not.toMatch(/\$/);
  });

  it('mensajes de acción con nombre del comercio', () => {
    expect(mensajeAccionSuscripcion('compromiso', 'Netflix')).toBe(
      'Listo: Hoy aparta tu Netflix antes de cada cargo.',
    );
    expect(mensajeAccionSuscripcion('cancelada', 'Smart Fit')).toBe(
      'Ya no te muestro Smart Fit. Si vuelve a cobrarse, te aviso aquí.',
    );
    expect(mensajeAccionSuscripcion('no_es', 'Dominio web')).toBe(
      'Listo: Dominio web ya no aparece como suscripción.',
    );
  });

  it('confirmación al renombrar', () => {
    expect(mensajeNombreGuardado('Dominio web')).toBe('Listo: la llamo Dominio web.');
  });
});
