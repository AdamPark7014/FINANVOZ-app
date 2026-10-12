// Límites de interpretaciones en la nube (docs/03-ARQUITECTURA.md §6, docs/01-PRD.md §11). La regla vive en la
// función SQL atómica `consumir_interpretacion` (migración 20261013000000_nlu_uso.sql); esta tabla la refleja
// y una prueba con PGlite comprueba que coincidan.

export type Plan = 'gratis' | 'plus' | 'negocio';

export const LIMITES_PLAN: Record<Plan, { diario: number; mensual: number }> = {
  gratis: { diario: 20, mensual: 30 },
  plus: { diario: 60, mensual: 300 },
  negocio: { diario: 60, mensual: 300 },
};

export type ResultadoCupo = 'ok' | 'limite_diario' | 'limite_mensual' | 'tope_global';

const RESULTADOS = new Set<string>(['ok', 'limite_diario', 'limite_mensual', 'tope_global']);
export const esResultadoCupo = (v: unknown): v is ResultadoCupo => typeof v === 'string' && RESULTADOS.has(v);

/** `NLU_TOPE_GLOBAL_DIARIO`: entero > 0; si falta o no es válido, el proxy no atiende (503 `sin_configurar`). */
export function leerTopeGlobal(valor: string | undefined): number | null {
  if (valor === undefined || !/^\d+$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}
