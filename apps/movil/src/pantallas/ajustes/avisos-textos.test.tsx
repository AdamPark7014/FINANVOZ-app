import {
  CONFIRMACION_HORARIO,
  DESC_HORARIO_SILENCIOSO,
  ETIQUETA_AVISOS_APAGADOS_TELEFONO,
  ETIQUETA_BLOQUE_HORARIO_SILENCIOSO,
  ETIQUETA_HORARIO_SILENCIOSO,
  ERROR_FORMATO_HORA,
  PISTA_ABRIR_AJUSTES_AVISOS,
  PISTA_GUARDAR_HORARIO,
  PISTA_PERMITIR_AVISOS,
} from './avisos-textos';

describe('avisos-textos (TalkBack, 02 §12)', () => {
  it('bloque horario silencioso agrupa título y descripción', () => {
    expect(ETIQUETA_BLOQUE_HORARIO_SILENCIOSO).toBe(
      `${ETIQUETA_HORARIO_SILENCIOSO}. ${DESC_HORARIO_SILENCIOSO}`,
    );
  });

  it('aviso sin permiso en el teléfono antepone «Aviso»', () => {
    expect(ETIQUETA_AVISOS_APAGADOS_TELEFONO).toMatch(/^Aviso\./);
    expect(ETIQUETA_AVISOS_APAGADOS_TELEFONO).toMatch(/tu teléfono/i);
  });

  it('pistas TalkBack usan tuteo donde aplica y no exclamación', () => {
    for (const pista of [PISTA_PERMITIR_AVISOS, PISTA_ABRIR_AJUSTES_AVISOS, PISTA_GUARDAR_HORARIO]) {
      expect(pista).not.toMatch(/!/);
    }
    expect(PISTA_PERMITIR_AVISOS).toMatch(/mandarte|tu teléfono/i);
    expect(PISTA_ABRIR_AJUSTES_AVISOS).toMatch(/teléfono/i);
    expect(CONFIRMACION_HORARIO).toMatch(/Tus avisos/i);
    expect(ERROR_FORMATO_HORA).not.toMatch(/!/);
  });
});
