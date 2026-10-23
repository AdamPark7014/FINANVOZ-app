import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  claveCuotaMsi,
  distribuirMayorResiduo,
  ErrorDominio,
  limiteDe,
  maxFecha,
  siguienteCorte,
  type Centavos,
  type CuotaMsi,
  type PlainDate,
  type TarjetaCredito,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import type { Contexto } from './contexto';
import { leerAjuste } from './preferencias';

const { cuenta, tarjeta, planMsi, transaccion } = esquema;

export interface TarjetaLeida {
  readonly cuentaId: string;
  readonly nombre: string;
  readonly ultimos4: string | null;
  readonly institucion: string | null;
  readonly modo: 'totalero' | 'plan';
  readonly limiteCredito: Centavos;
  readonly tasaAnualBp: number | null;
  readonly alta: PlainDate;
  readonly ciclo: TarjetaCredito;
  /** Deuda revolvente (sin MSI no facturados); negativa = saldo a favor. */
  readonly saldoRevolvente: Centavos;
}

type FilaTarjeta = typeof tarjeta.$inferSelect;

export function cicloDeFila(
  f: Pick<FilaTarjeta, 'diaCorte' | 'diasParaPagar' | 'diaLimitePago'>,
): TarjetaCredito {
  return f.diasParaPagar !== null
    ? { diaCorte: f.diaCorte, diasParaPagar: f.diasParaPagar }
    : { diaCorte: f.diaCorte, diaLimitePago: f.diaLimitePago as number };
}

function leerTarjeta(ctx: Contexto, c: typeof cuenta.$inferSelect, t: FilaTarjeta): TarjetaLeida {
  return {
    cuentaId: c.id,
    nombre: c.nombre,
    ultimos4: c.ultimos4,
    institucion: c.institucion,
    modo: t.modo,
    limiteCredito: t.limiteCredito,
    tasaAnualBp: t.tasaAnualBp,
    alta: t.alta,
    ciclo: cicloDeFila(t),
    saldoRevolvente: -ctx.libro.saldo(c.id),
  };
}

/** Tarjetas de crédito activas del espacio personal, en orden de alta. */
export function tarjetasActivas(ctx: Contexto): TarjetaLeida[] {
  return ctx.db
    .select({ c: cuenta, t: tarjeta })
    .from(tarjeta)
    .innerJoin(cuenta, eq(cuenta.id, tarjeta.cuentaId))
    .where(and(eq(cuenta.archivada, 0), eq(cuenta.espacio, 'personal')))
    .orderBy(asc(cuenta.creadaEn), asc(cuenta.id))
    .all()
    .map(({ c, t }) => leerTarjeta(ctx, c, t));
}

/** Una tarjeta por id de su cuenta; `tarjeta_inexistente` si no existe o no es tarjeta. */
export function tarjetaPorId(ctx: Contexto, id: string): TarjetaLeida {
  const fila = ctx.db
    .select({ c: cuenta, t: tarjeta })
    .from(tarjeta)
    .innerJoin(cuenta, eq(cuenta.id, tarjeta.cuentaId))
    .where(eq(tarjeta.cuentaId, id))
    .get();
  if (!fila) throw new ErrorDominio('tarjeta_inexistente', 'esa tarjeta no existe');
  return leerTarjeta(ctx, fila.c, fila.t);
}

// ——— Cambio de ciclo ———

const CicloDesde = z.strictObject({ fecha: z.string() });
export const claveCicloDesde = (tarjetaId: string) => `ciclo_desde:${tarjetaId}`;

/**
 * Desde cuándo se procesan cortes (E5.3): el alta o, si la persona cambió el día de corte después, la fecha del
 * cambio (los cortes anteriores ya se cerraron con el ciclo viejo).
 */
export function inicioCortes(ctx: Contexto, t: Pick<TarjetaLeida, 'cuentaId' | 'alta'>): PlainDate {
  const cambio = leerAjuste(ctx, claveCicloDesde(t.cuentaId), CicloDesde);
  return cambio ? maxFecha(t.alta, cambio.fecha) : t.alta;
}

// ——— Planes MSI ———

export type EstadoPlan = 'activo' | 'liquidado' | 'terminado';

export interface PlanLeido {
  readonly id: string;
  readonly tarjetaId: string;
  readonly cuentaMsiId: string;
  readonly descripcion: string;
  readonly transaccionAltaId: string;
  readonly origenAlta: 'compra' | 'existente' | 'pasar_a_meses';
  readonly monto: Centavos;
  readonly meses: number;
  readonly mesesDiferimiento: number;
  readonly fechaCompra: PlainDate | null;
  readonly primerCorte: PlainDate;
  readonly estado: EstadoPlan;
}

/** ¿La transacción que dio de alta el plan sigue vigente (no se anuló ni se reemplazó)? */
function altaAnulada(ctx: Contexto, transaccionId: string): boolean {
  return !!ctx.db
    .select({ id: transaccion.id })
    .from(transaccion)
    .where(eq(transaccion.revierteA, transaccionId))
    .get();
}

/**
 * Planes MSI vigentes: los que no se deshicieron (su transacción de alta no está anulada). Un plan cuya compra
 * se anuló o se volvió a capturar como compra normal deja de existir para E4 y para el cierre de cortes.
 */
export function planesVigentes(
  ctx: Contexto,
  filtro: { tarjetaId?: string; estados?: readonly EstadoPlan[] } = {},
): PlanLeido[] {
  const condiciones = [];
  if (filtro.tarjetaId) condiciones.push(eq(planMsi.tarjetaId, filtro.tarjetaId));
  if (filtro.estados) condiciones.push(inArray(planMsi.estado, [...filtro.estados]));
  return ctx.db
    .select({ p: planMsi, nombre: cuenta.nombre })
    .from(planMsi)
    .innerJoin(cuenta, eq(cuenta.id, planMsi.cuentaMsiId))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(asc(planMsi.primerCorte), asc(planMsi.id))
    .all()
    .filter(({ p }) => !altaAnulada(ctx, p.transaccionAltaId))
    .map(({ p, nombre }) => ({
      id: p.id,
      tarjetaId: p.tarjetaId,
      cuentaMsiId: p.cuentaMsiId,
      descripcion: nombre,
      transaccionAltaId: p.transaccionAltaId,
      origenAlta: p.origenAlta,
      monto: p.monto,
      meses: p.meses,
      mesesDiferimiento: p.mesesDiferimiento,
      fechaCompra: p.fechaCompra,
      primerCorte: p.primerCorte,
      estado: p.estado,
    }));
}

export type EstadoCuota = 'facturada' | 'por_facturar' | 'liquidada';

export interface CuotaPlan extends CuotaMsi {
  readonly planId: string;
  readonly tarjetaId: string;
  readonly estado: EstadoCuota;
}

/**
 * Calendario completo de un plan (`04 §3`): la cuota k vale `distribuirMayorResiduo(monto, [1 × meses])[k−1]`
 * y se factura en el corte k−1 posterior a `primer_corte`. Facturada = ya tiene su transacción `msi:{plan}:{k}`;
 * en un plan liquidado las que faltaban quedan "liquidadas" (ya no se generan).
 */
export function cuotasDePlan(ctx: Contexto, plan: PlanLeido, ciclo?: TarjetaCredito): CuotaPlan[] {
  const c = ciclo ?? tarjetaPorId(ctx, plan.tarjetaId).ciclo;
  const claves = Array.from({ length: plan.meses }, (_, i) => claveCuotaMsi(plan.id, i + 1));
  const hechas = new Set(
    ctx.db
      .select({ clave: transaccion.claveIdempotencia })
      .from(transaccion)
      .where(inArray(transaccion.claveIdempotencia, claves))
      .all()
      .map((f) => f.clave),
  );
  const montos = distribuirMayorResiduo(
    plan.monto,
    Array.from({ length: plan.meses }, () => 1),
  );
  const salida: CuotaPlan[] = [];
  let corte = plan.primerCorte;
  montos.forEach((monto, i) => {
    const facturada = hechas.has(claveCuotaMsi(plan.id, i + 1));
    salida.push({
      planId: plan.id,
      tarjetaId: plan.tarjetaId,
      n: i + 1,
      monto,
      corte,
      limite: limiteDe(c, corte),
      estado: facturada ? 'facturada' : plan.estado === 'liquidado' ? 'liquidada' : 'por_facturar',
    });
    corte = siguienteCorte(c, corte);
  });
  return salida;
}

export interface CuotaPendiente extends CuotaMsi {
  readonly planId: string;
  readonly tarjetaId: string;
}

/**
 * Cuotas MSI aún no facturadas de los planes activos y vigentes (E4: `cuotas_msi_no_facturadas`). Las que ya se
 * reclasificaron en su corte (E6.2) son deuda revolvente de la tarjeta.
 */
export function cuotasMsiPendientes(ctx: Contexto, tarjetaId?: string): CuotaPendiente[] {
  const ciclos = new Map<string, TarjetaCredito>();
  const salida: CuotaPendiente[] = [];
  for (const plan of planesVigentes(ctx, { estados: ['activo'], ...(tarjetaId ? { tarjetaId } : {}) })) {
    let ciclo = ciclos.get(plan.tarjetaId);
    if (!ciclo) {
      ciclo = tarjetaPorId(ctx, plan.tarjetaId).ciclo;
      ciclos.set(plan.tarjetaId, ciclo);
    }
    for (const c of cuotasDePlan(ctx, plan, ciclo)) {
      if (c.estado === 'por_facturar') {
        salida.push({
          planId: c.planId,
          tarjetaId: c.tarjetaId,
          n: c.n,
          monto: c.monto,
          corte: c.corte,
          limite: c.limite,
        });
      }
    }
  }
  return salida;
}

/** Lo que falta de los meses de una tarjeta (saldo de sus subcuentas MSI vigentes). */
export function msiPorPagar(ctx: Contexto, tarjetaId: string): Centavos {
  return ctx.db
    .select({ id: cuenta.id })
    .from(cuenta)
    .where(and(eq(cuenta.padreId, tarjetaId), eq(cuenta.subtipo, 'msi')))
    .all()
    .reduce((s, c) => s - ctx.libro.saldo(c.id), 0);
}

// ——— Alta por voz sin límite dicho (Ola 7, `src/asistente/flujos/tarjeta.ts`) ———

/** Lo mínimo que acepta la base como límite (`CHECK (limite_credito > 0)`): $1. */
export const LIMITE_MINIMO_SIN_DATO: Centavos = 100;

/**
 * Límite de crédito de una tarjeta agregada por voz cuando la persona no lo dijo (CA-O7 6: dos preguntas). La base
 * exige uno: se guarda lo que debe hoy (mínimo $1). Así no se inventa crédito disponible: el uso queda al 100 % y
 * `recomendarTarjeta` (E5.2) no la sugiere para compras hasta que la persona lo corrija en Editar. No entra en E4.
 */
export function limiteSinDato(saldo: Centavos): Centavos {
  return Math.max(saldo, LIMITE_MINIMO_SIN_DATO);
}
