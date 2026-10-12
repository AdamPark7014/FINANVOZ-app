import { ErrorDominio } from '../errores';

/** Una predicción cerrada (E8.6): `p_predicha` (K = 1) en puntos base y si se llegó (`E_final ≥ 0`). */
export interface PrediccionCerrada {
  readonly probabilidad_bp: number;
  readonly resultado: boolean;
}

/** Objetivo de calibración en beta (E8.6). */
export const BRIER_OBJETIVO = 0.2;

/** E8.6 · Brier = promedio de `(p − resultado)²`; `null` sin predicciones cerradas. */
export function brier(predicciones: readonly PrediccionCerrada[]): number | null {
  if (predicciones.length === 0) return null;
  let suma = 0;
  for (const p of predicciones) {
    if (!Number.isSafeInteger(p.probabilidad_bp) || p.probabilidad_bp < 0 || p.probabilidad_bp > 10000) {
      throw new ErrorDominio('prediccion_invalida', 'probabilidad_bp fuera de 0–10000');
    }
    const d = p.probabilidad_bp / 10000 - (p.resultado ? 1 : 0);
    suma += d * d;
  }
  return suma / predicciones.length;
}

/** Probabilidad en puntos base enteros (`exitos·10000/n`, mitad hacia arriba, sin flotantes). */
export function probabilidadBp(exitos: number, n: number): number {
  if (!Number.isSafeInteger(exitos) || !Number.isSafeInteger(n) || n <= 0 || exitos < 0 || exitos > n) {
    throw new ErrorDominio('prediccion_invalida', 'exitos y n inválidos');
  }
  return Math.floor((2 * exitos * 10000 + n) / (2 * n));
}
