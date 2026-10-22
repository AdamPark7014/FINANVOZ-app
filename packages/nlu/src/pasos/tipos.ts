/**
 * Tipos de los lectores por paso del onboarding (docs/06-NLU.md §13). El esquema canónico es Zod (`./esquema`);
 * aquí viven los nombres que usa la app.
 */
import type { ContextoInterprete } from '../contexto';
import type { Tokens } from '../reglas/tokens';
import type { LecturaPaso, PASOS } from './esquema';

export type { Cifra, LecturaPaso } from './esquema';

/** O3 ingreso · O4 efectivo, cuentas y tarjeta · O5 pagos fijos · O7 colchón · alta de tanda. */
export type Paso = (typeof PASOS)[number];

/**
 * Contexto de un paso: el mismo contexto mínimo del intérprete (`06 §4`), con las cuentas que la persona ya dio de
 * alta (en el onboarding suele venir sin cuentas). El catálogo de instituciones lo agrega `interpretarPaso`.
 */
export type ContextoPaso = ContextoInterprete;

export type LecturaDe<P extends Paso> = Extract<LecturaPaso, { paso: P }>;

/** Gramática propia de un paso: lee la frase completa o devuelve `null`. */
export type GramaticaPaso<P extends Paso> = (tokens: Tokens, contexto: ContextoPaso) => LecturaDe<P> | null;
