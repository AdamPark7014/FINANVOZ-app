import {
  PISTA_AGREGAR_DATOS_COBRO,
  PISTA_BORRAR_DATOS_COBRO,
  PISTA_CAMBIAR_DATOS_COBRO,
  PISTA_RESUMEN_DATOS_COBRO,
  etiquetaResumenDatosCobro,
  SECCION_DATOS_COBRO,
} from './datos-cobro-textos';

describe('datos-cobro-textos (TalkBack, 02 §17)', () => {
  it('resumen incluye el título de sección', () => {
    expect(etiquetaResumenDatosCobro('Celular: 55 1234 5678')).toBe(
      `${SECCION_DATOS_COBRO}. Celular: 55 1234 5678`,
    );
  });

  it('pistas TalkBack usan tuteo', () => {
    for (const pista of [
      PISTA_AGREGAR_DATOS_COBRO,
      PISTA_CAMBIAR_DATOS_COBRO,
      PISTA_BORRAR_DATOS_COBRO,
      PISTA_RESUMEN_DATOS_COBRO,
    ]) {
      expect(pista).toMatch(/\btu\b/i);
      expect(pista).not.toMatch(/!/);
    }
  });
});
