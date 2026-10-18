import {
  INTERPRETACIONES_POR_PREGUNTA as NLU,
  INTERPRETACIONES_POR_PREGUNTA_ESTIMADO as NLU_EST,
  LLAMADAS_HERRAMIENTA_MAX as NLU_HERR,
  VUELTAS_HTTP_MAX_POR_PREGUNTA as NLU_VUELTAS,
} from '@cartera/nlu';
import { describe, expect, it } from 'vitest';
import {
  INTERPRETACIONES_POR_PREGUNTA,
  INTERPRETACIONES_POR_PREGUNTA_ESTIMADO,
  LLAMADAS_HERRAMIENTA_MAX,
  VUELTAS_HTTP_MAX_POR_PREGUNTA,
} from './cupo-explicar.ts';
import { LLAMADAS_MAXIMAS } from './contrato.ts';

describe('cupo-explicar (proxy ↔ nlu)', () => {
  it('coincide con packages/nlu y con LLAMADAS_MAXIMAS del contrato', () => {
    expect(LLAMADAS_HERRAMIENTA_MAX).toBe(LLAMADAS_MAXIMAS);
    expect(LLAMADAS_HERRAMIENTA_MAX).toBe(NLU_HERR);
    expect(VUELTAS_HTTP_MAX_POR_PREGUNTA).toBe(NLU_VUELTAS);
    expect(INTERPRETACIONES_POR_PREGUNTA).toEqual(NLU);
    expect(INTERPRETACIONES_POR_PREGUNTA_ESTIMADO).toEqual(NLU_EST);
  });
});
