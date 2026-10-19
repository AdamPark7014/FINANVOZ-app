import {
  etiquetaAccesibleAyudaSuscripciones,
  etiquetaAccesibleHoyApartaSuscripcion,
  etiquetaAccesibleProximoSuscripcion,
  etiquetaAccesibleResumenSuscripciones,
  TEXTO_HOY_APARTA,
  etiquetaAccesibleInactivasBoton,
  etiquetaAccesibleInactivasEncabezado,
  etiquetaAccesibleInactivasDetalle,
  etiquetaAccesibleMontoSuscripcion,
  etiquetaVacioSuscripciones,
  mensajeAccionSuscripcion,
  mensajeNombreGuardado,
  PISTA_AYUDA,
  pistaInactivasSuscripciones,
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

  it('inactivas: encabezado, botón plegado y detalle', () => {
    expect(etiquetaAccesibleInactivasEncabezado(1)).toBe('Ya no se cobran, 1 suscripción');
    expect(etiquetaAccesibleInactivasEncabezado(3)).toBe('Ya no se cobran, 3 suscripciones');
    const detalle = 'Ya no se cobran: Disney Plus (último cargo 20 jul)';
    expect(etiquetaAccesibleInactivasBoton(1, detalle, false)).toContain('Disney Plus');
    expect(etiquetaAccesibleInactivasBoton(1, detalle, true)).toBe(etiquetaAccesibleInactivasEncabezado(1));
    expect(etiquetaAccesibleInactivasDetalle(detalle)).toBe(detalle);
  });

  it('monto de fila con aumento en palabras', () => {
    expect(etiquetaAccesibleMontoSuscripcion('$129 al mes', 'antes $115')).toMatch(/^Monto\./);
    expect(etiquetaAccesibleMontoSuscripcion('$129 al mes', 'antes $115')).toMatch(/pesos/);
    expect(etiquetaAccesibleMontoSuscripcion('$129 al mes', 'antes $115')).not.toMatch(/\$/);
  });

  it('acordeón inactivas: pista Despliega o Pliega', () => {
    expect(pistaInactivasSuscripciones(false)).toMatch(/Despliega/);
    expect(pistaInactivasSuscripciones(true)).toMatch(/Pliega/);
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
