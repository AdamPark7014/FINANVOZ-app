// Cupo del modo explicar (M10, pendiente 88): documenta cuántas interpretaciones puede costar una pregunta.
// Debe coincidir con `packages/nlu/src/explicar/cupo.ts` (una prueba lo verifica).
import { LLAMADAS_MAXIMAS } from './contrato.ts';

/** Alias del contrato HTTP: herramientas de solo lectura por pregunta (`06 §6`). */
export const LLAMADAS_HERRAMIENTA_MAX = LLAMADAS_MAXIMAS;

/** Cada `POST /llm/turno` consume una interpretación vía `consumir_turno_llm`. */
export const INTERPRETACIONES_POR_TURNO_HTTP = 1;

/** Vueltas HTTP máximas que encadena el teléfono (`apps/movil/src/servicios/explicar.ts`). */
export const VUELTAS_HTTP_MAX_POR_PREGUNTA = LLAMADAS_HERRAMIENTA_MAX + INTERPRETACIONES_POR_TURNO_HTTP;

export const INTERPRETACIONES_POR_PREGUNTA = {
  min: INTERPRETACIONES_POR_TURNO_HTTP,
  max: VUELTAS_HTTP_MAX_POR_PREGUNTA,
} as const;

/** Estimación conservadora (docs/ESTADO.md · pendiente 88) para capacidad Plus y métricas. */
export const INTERPRETACIONES_POR_PREGUNTA_ESTIMADO = { min: 2, max: 4 } as const;
