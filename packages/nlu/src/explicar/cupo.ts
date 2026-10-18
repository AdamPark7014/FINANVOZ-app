/**
 * Cupo del modo explicar (`POST /llm/turno`, pendiente 88 · `docs/ESTADO.md`): cada llamada HTTP al proxy
 * consume **una** interpretación del mismo contador que `/nlu/interpretar` (`consumir_turno_llm`). El teléfono
 * encadena varias vueltas por pregunta (herramientas + respuesta final).
 */

/** Llamadas a herramientas de solo lectura permitidas por pregunta (`06 §6`, `_shared/llm/contrato.ts`). */
export const LLAMADAS_HERRAMIENTA_MAX = 3;

/** Interpretaciones que descuenta el proxy por cada `POST /llm/turno` exitoso o fallido (502/504 se devuelven). */
export const INTERPRETACIONES_POR_TURNO_HTTP = 1;

/** Vueltas HTTP máximas por pregunta: bucle del teléfono permite una vuelta extra tras agotar herramientas. */
export const VUELTAS_HTTP_MAX_POR_PREGUNTA = LLAMADAS_HERRAMIENTA_MAX + INTERPRETACIONES_POR_TURNO_HTTP;

/** Rango real de interpretaciones por pregunta completa (derivado de las constantes anteriores). */
export const INTERPRETACIONES_POR_PREGUNTA = {
  /** El modelo puede responder en la primera vuelta sin pedir herramientas. */
  min: INTERPRETACIONES_POR_TURNO_HTTP,
  max: VUELTAS_HTTP_MAX_POR_PREGUNTA,
} as const;

/**
 * Estimación conservadora para producto y límites Plus (60/día → ~15–30 preguntas): la mayoría de preguntas
 * usan al menos una herramienta. Se revisará con uso real (pendiente 88).
 */
export const INTERPRETACIONES_POR_PREGUNTA_ESTIMADO = { min: 2, max: 4 } as const;
