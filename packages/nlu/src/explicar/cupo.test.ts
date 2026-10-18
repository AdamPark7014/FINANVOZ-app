import { describe, expect, it } from 'vitest';
import {
  INTERPRETACIONES_POR_PREGUNTA,
  INTERPRETACIONES_POR_PREGUNTA_ESTIMADO,
  INTERPRETACIONES_POR_TURNO_HTTP,
  LLAMADAS_HERRAMIENTA_MAX,
  VUELTAS_HTTP_MAX_POR_PREGUNTA,
} from './cupo';

describe('cupo modo explicar', () => {
  it('cada POST al proxy consume una interpretación', () => {
    expect(INTERPRETACIONES_POR_TURNO_HTTP).toBe(1);
  });

  it('como máximo cuatro vueltas HTTP por pregunta (3 herramientas + cierre)', () => {
    expect(VUELTAS_HTTP_MAX_POR_PREGUNTA).toBe(LLAMADAS_HERRAMIENTA_MAX + 1);
    expect(INTERPRETACIONES_POR_PREGUNTA).toEqual({ min: 1, max: 4 });
  });

  it('la estimación conservadora cubre el rango real', () => {
    expect(INTERPRETACIONES_POR_PREGUNTA_ESTIMADO.min).toBeGreaterThanOrEqual(
      INTERPRETACIONES_POR_PREGUNTA.min,
    );
    expect(INTERPRETACIONES_POR_PREGUNTA_ESTIMADO.max).toBeGreaterThanOrEqual(
      INTERPRETACIONES_POR_PREGUNTA.max,
    );
  });
});
