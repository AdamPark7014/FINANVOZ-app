import {
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

  it('etiqueta hablada del vacío incluye título de pantalla', () => {
    expect(etiquetaVacioSuscripciones()).toBe(`${TITULO_PANTALLA}. ${TEXTO_SUSCRIPCIONES_VACIO}`);
  });

  it('ayuda en plural para varias filas', () => {
    expect(PISTA_AYUDA).toContain('Conviértelas');
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
