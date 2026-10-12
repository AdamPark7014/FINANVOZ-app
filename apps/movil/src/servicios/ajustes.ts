import { z } from 'zod';
import { ErrorDominio, type Centavos, type PlainDate } from '@cartera/core';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import type { Contexto } from './contexto';
import { CentavosNoNegativos, borrarAjuste, escribirAjuste, leerAjuste } from './preferencias';
import { ingresoPrincipal, type ProgramadoLeido } from './programados';

const Colchon = z.strictObject({ monto: CentavosNoNegativos });
const ModoIngreso = z.strictObject({ modo: z.literal('variable') });
const Onboarding = z.strictObject({ completado: z.boolean(), completado_en: z.int().nullable() });

/** RF-CFG-03: bloqueo con biometría o PIN del sistema y "ocultar en multitarea". */
export const PreferenciasBloqueo = z.strictObject({
  activo: z.boolean(),
  ocultarEnMultitarea: z.boolean(),
  /** Segundos en segundo plano antes de pedir desbloqueo (CA-M2-11: 1 min). */
  trasSegundos: z.int().min(0).max(3600),
});
export type PreferenciasBloqueo = z.infer<typeof PreferenciasBloqueo>;

export const BLOQUEO_POR_OMISION: PreferenciasBloqueo = {
  activo: false,
  ocultarEnMultitarea: false,
  trasSegundos: 60,
};

/** O7 · colchón: lo que la persona no quiere tocar nunca. */
export function fijarColchon(ctx: Contexto, monto: Centavos): void {
  exigirConsentimiento(ctx);
  if (!Number.isSafeInteger(monto) || monto < 0) throw new ErrorDominio('monto_invalido', 'colchón inválido');
  escribirAjuste(ctx, 'colchon', Colchon, { monto });
}

export function obtenerColchon(ctx: Contexto): Centavos {
  return leerAjuste(ctx, 'colchon', Colchon)?.monto ?? 0;
}

/** Sugerencia de O7: 10 % del ingreso del periodo, en pesos cerrados. */
export function colchonSugerido(ctx: Contexto): Centavos {
  const ingreso = ingresoPrincipal(ctx);
  return ingreso ? Math.floor(ingreso.monto / 1000) * 100 : 0;
}

export function marcarIngresoVariable(ctx: Contexto, variable: boolean): void {
  if (variable) escribirAjuste(ctx, 'ingreso', ModoIngreso, { modo: 'variable' });
  else borrarAjuste(ctx, 'ingreso');
}

export function esIngresoVariable(ctx: Contexto): boolean {
  return leerAjuste(ctx, 'ingreso', ModoIngreso)?.modo === 'variable';
}

export function obtenerBloqueo(ctx: Contexto): PreferenciasBloqueo {
  return leerAjuste(ctx, 'bloqueo', PreferenciasBloqueo) ?? BLOQUEO_POR_OMISION;
}

export function fijarBloqueo(ctx: Contexto, cambios: Partial<PreferenciasBloqueo>): PreferenciasBloqueo {
  exigirConsentimiento(ctx);
  const nuevo = { ...obtenerBloqueo(ctx), ...cambios };
  escribirAjuste(ctx, 'bloqueo', PreferenciasBloqueo, nuevo);
  return nuevo;
}

export function completarOnboarding(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, 'onboarding', Onboarding, { completado: true, completado_en: ctx.reloj.ahora() });
}

export function onboardingCompletado(ctx: Contexto): boolean {
  return leerAjuste(ctx, 'onboarding', Onboarding)?.completado ?? false;
}

/** Fecha civil en que terminó el onboarding; `null` si no ha terminado (o no se guardó el instante). */
export function fechaOnboarding(ctx: Contexto): PlainDate | null {
  const o = leerAjuste(ctx, 'onboarding', Onboarding);
  if (!o?.completado || o.completado_en === null) return null;
  return ctx.reloj.fechaDe ? ctx.reloj.fechaDe(o.completado_en) : ctx.reloj.hoy();
}

export interface VistaAjustes {
  readonly colchon: Centavos;
  readonly ingreso: ProgramadoLeido | null;
  readonly ingresoVariable: boolean;
  readonly bloqueo: PreferenciasBloqueo;
}

export function obtenerAjustes(ctx: Contexto): VistaAjustes {
  return {
    colchon: obtenerColchon(ctx),
    ingreso: ingresoPrincipal(ctx),
    ingresoVariable: esIngresoVariable(ctx),
    bloqueo: obtenerBloqueo(ctx),
  };
}
