import type { PlainDate } from '@cartera/core';
import { z } from 'zod';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste } from './preferencias';

export type { CodigoLimite } from '@cartera/nlu';

/**
 * Planes Gratis y Plus (RF-PAG-01, `01 §11`). La tienda (Google Play, vía RevenueCat) es la fuente de verdad; la
 * app guarda en `ajuste` `plan` lo último que supo, con su vencimiento, para decidir sin red. Un Plus vencido es
 * Gratis aunque la tienda no haya vuelto a hablar (al terminar la prueba sin pagar o al vencer una cancelación).
 *
 * Ningún dato depende del plan: todas las vistas de servicios (Hoy, cuentas, movimientos, tarjetas, MSI,
 * exportar) responden igual en Gratis y en Plus. El plan solo decide qué funciones de análisis muestra la UI
 * (`funcionesPlan`) y el cupo del intérprete en la nube, que aplica el proxy.
 */

export type Plan = 'gratis' | 'plus';

/** Días de la prueba gratis de Plus (la configura Play Console; aquí solo se usa en la redacción). */
export const DIAS_PRUEBA = 14;

/** Interpretaciones en la nube al mes por plan (`01 §11`); las aplica el proxy (`consumir_interpretacion`). */
export const INTERPRETACIONES_NUBE_MES: Record<Plan, number> = { gratis: 30, plus: 300 };

/** Lo que la tienda dice del derecho Plus. El adaptador de compras lo arma a partir de RevenueCat. */
export interface EstadoTienda {
  readonly plus: {
    /** Fin del periodo pagado o de la prueba, ms UTC; `null` = sin vencimiento. */
    readonly vigenteHasta: number | null;
    readonly enPrueba: boolean;
    /** `false` si la persona ya canceló (sigue en Plus hasta `vigenteHasta`). */
    readonly renovara: boolean;
  } | null;
}

export const SIN_PLUS: EstadoTienda = { plus: null };

export interface VistaPlan {
  readonly plan: Plan;
  readonly enPrueba: boolean;
  /** Días que le quedan a la prueba o al periodo de Plus; `null` en Gratis o sin vencimiento. */
  readonly diasRestantes: number | null;
  readonly vigenteHasta: number | null;
  /** Fecha civil del fin de la prueba o del periodo ("hasta el 26 oct"); `null` sin vencimiento. */
  readonly fechaFin: PlainDate | null;
  readonly renovara: boolean;
  /** En Gratis, si antes tuvo Plus: terminó la prueba o la suscripción. Para decir "todo sigue aquí". */
  readonly terminoPlus: 'prueba' | 'suscripcion' | null;
}

/** Qué funciones de Plus muestra la UI. Los datos nunca se ocultan. */
export interface FuncionesPlan {
  /** Probabilidad de llegar en Hoy (RF-HOY-02). En Gratis: candado "Ver probabilidad · Plus". */
  readonly probabilidad: boolean;
  /** Tarjeta del día (RF-HOY-04). En Gratis no aparece. */
  readonly tarjetaDelDia: boolean;
  /** "¿Me alcanza?" (RF-SIM-01). */
  readonly meAlcanza: boolean;
  /** Compromiso de meses de los próximos 12 meses en el detalle de la tarjeta. */
  readonly compromisoMsi12Meses: boolean;
  /** Consultas tipadas (RF-CON-01) salvo "¿cuánto puedo gastar hoy?", que es el "hoy puedes" de Gratis. */
  readonly consultas: boolean;
  /** Modo explicar: preguntas abiertas con herramientas (RF-CON-02, `02 §22`). */
  readonly explicar: boolean;
  readonly interpretacionesNubeMes: number;
}

const CLAVE = 'plan';
const DIA_MS = 86_400_000;

const PlanGuardado = z.strictObject({
  plus: z
    .strictObject({
      vigente_hasta: z.int().nullable(),
      en_prueba: z.boolean(),
      renovara: z.boolean(),
    })
    .nullable(),
  termino: z.enum(['prueba', 'suscripcion']).nullable(),
  verificado_en: z.int(),
});
type PlanGuardado = z.infer<typeof PlanGuardado>;

const vigente = (vigenteHasta: number | null, ahora: number) => vigenteHasta === null || vigenteHasta > ahora;

/** Guarda lo que dijo la tienda (al abrir la app, al comprar, al restaurar o cuando RevenueCat avisa un cambio). */
export function sincronizarPlan(ctx: Contexto, estado: EstadoTienda): VistaPlan {
  const previo = leerAjuste(ctx, CLAVE, PlanGuardado);
  const ahora = ctx.reloj.ahora();
  const terminoPrevio = (): PlanGuardado['termino'] => {
    if (previo?.plus) return previo.plus.en_prueba ? 'prueba' : 'suscripcion';
    return previo?.termino ?? null;
  };
  const activo = estado.plus !== null && vigente(estado.plus.vigenteHasta, ahora);
  escribirAjuste(ctx, CLAVE, PlanGuardado, {
    plus: estado.plus
      ? {
          vigente_hasta: estado.plus.vigenteHasta,
          en_prueba: estado.plus.enPrueba,
          renovara: estado.plus.renovara,
        }
      : null,
    termino: activo ? null : terminoPrevio(),
    verificado_en: ahora,
  });
  return obtenerPlan(ctx);
}

export function obtenerPlan(ctx: Contexto): VistaPlan {
  const g = leerAjuste(ctx, CLAVE, PlanGuardado);
  const ahora = ctx.reloj.ahora();
  if (g?.plus && vigente(g.plus.vigente_hasta, ahora)) {
    return {
      plan: 'plus',
      enPrueba: g.plus.en_prueba,
      diasRestantes:
        g.plus.vigente_hasta === null ? null : Math.ceil((g.plus.vigente_hasta - ahora) / DIA_MS),
      vigenteHasta: g.plus.vigente_hasta,
      fechaFin: g.plus.vigente_hasta === null ? null : (ctx.reloj.fechaDe?.(g.plus.vigente_hasta) ?? null),
      renovara: g.plus.renovara,
      terminoPlus: null,
    };
  }
  return {
    plan: 'gratis',
    enPrueba: false,
    diasRestantes: null,
    vigenteHasta: null,
    fechaFin: null,
    renovara: false,
    terminoPlus: g?.plus ? (g.plus.en_prueba ? 'prueba' : 'suscripcion') : (g?.termino ?? null),
  };
}

export function funcionesPlan(ctx: Contexto): FuncionesPlan {
  const plus = obtenerPlan(ctx).plan === 'plus';
  return {
    probabilidad: plus,
    tarjetaDelDia: plus,
    meAlcanza: plus,
    compromisoMsi12Meses: plus,
    consultas: plus,
    explicar: plus,
    interpretacionesNubeMes: INTERPRETACIONES_NUBE_MES[plus ? 'plus' : 'gratis'],
  };
}
