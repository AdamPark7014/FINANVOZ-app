import type { Centavos, PlainDate, Regla } from '@cartera/core';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { fijarColchon, obtenerColchon } from './ajustes';
import type { Contexto } from './contexto';
import { configurarIngreso, EntradaIngreso, proximoPago } from './onboarding';
import { ingresoPrincipal } from './programados';

/** «Mi colchón es de 2 mil» (`06 §9.2`): aplicado al momento, con Deshacer que regresa al anterior. */
export interface ColchonDicho {
  readonly resultado: 'colchon_configurado';
  readonly monto: Centavos;
  readonly anterior: Centavos;
  /** Token de Deshacer: `k:<anterior>`. */
  readonly deshacer: string;
}

export function configurarColchonDicho(ctx: Contexto, monto: Centavos): ColchonDicho {
  exigirConsentimiento(ctx);
  const anterior = obtenerColchon(ctx);
  fijarColchon(ctx, monto);
  return { resultado: 'colchon_configurado', monto, anterior, deshacer: `k:${anterior}` };
}

/** Deshacer de `configurarColchonDicho`. */
export function deshacerColchon(ctx: Contexto, anterior: string): void {
  const monto = Number(anterior);
  if (Number.isSafeInteger(monto) && monto >= 0) fijarColchon(ctx, monto);
}

/**
 * «Me pagan 8 mil cada quincena, el 15 y el último»: cambia el ingreso que define el horizonte, así que nunca se
 * aplica solo. La tarjeta muestra lo entendido junto al ingreso de hoy y guarda con `confirmarIngresoDicho`.
 */
export interface PropuestaIngreso {
  readonly monto: Centavos;
  readonly regla: Regla;
  readonly proximo: PlainDate | null;
  /** El ingreso que se reemplaza, si había uno. */
  readonly anterior: { readonly monto: Centavos; readonly regla: Regla } | null;
}

/** `null` si la regla no sirve para un ingreso (p. ej. una fecha única). */
export function proponerIngresoDicho(
  ctx: Contexto,
  dicho: { readonly monto: Centavos; readonly regla: Regla },
): PropuestaIngreso | null {
  const valida = EntradaIngreso.safeParse({ monto: dicho.monto, regla: dicho.regla });
  if (!valida.success) return null;
  const actual = ingresoPrincipal(ctx);
  return {
    monto: dicho.monto,
    regla: dicho.regla,
    proximo: proximoPago(dicho.regla, ctx.reloj.hoy()),
    anterior: actual ? { monto: actual.monto, regla: actual.regla } : null,
  };
}

export function confirmarIngresoDicho(ctx: Contexto, propuesta: PropuestaIngreso): string {
  return configurarIngreso(ctx, {
    concepto: conceptoDeRegla(propuesta.regla),
    monto: propuesta.monto,
    regla: propuesta.regla,
  });
}

/** El mismo concepto que O3 (`conceptoIngreso`), desde la regla. */
function conceptoDeRegla(regla: Regla): string {
  if (regla.tipo.startsWith('quincenal')) return 'quincena';
  if (regla.tipo === 'semanal') return 'semana';
  return 'sueldo';
}
