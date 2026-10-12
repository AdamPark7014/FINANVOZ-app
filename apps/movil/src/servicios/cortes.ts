import { and, asc, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import {
  construirReclasificacionMsi,
  cortesAProcesar,
  limiteDe,
  pngiDe,
  type Centavos,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { enTransaccion, type Contexto } from './contexto';
import {
  cuotasDePlan,
  inicioCortes,
  planesVigentes,
  tarjetaPorId,
  tarjetasActivas,
  type TarjetaLeida,
} from './tarjetas';

const { estadoCuenta, planMsi, asiento, transaccionVigente } = esquema;

/** Estado de cuenta de un corte ya cerrado, con el PNGI derivado (E5.3). */
export interface EstadoCuentaVista {
  readonly tarjetaId: string;
  readonly corte: PlainDate;
  readonly limite: PlainDate;
  /** Revolvente al corte, ya con las cuotas MSI de ese corte; negativo = saldo a favor. */
  readonly saldoCorte: Centavos;
  /** Pagos y abonos con fecha posterior al corte. */
  readonly pagosPosteriores: Centavos;
  /** Pago para no generar intereses: `max(0, saldo_corte − pagos posteriores)`. */
  readonly pngi: Centavos;
}

/**
 * Tipos que cuentan como "pagos y abonos" a la tarjeta para el PNGI: pagos, devoluciones, bonificaciones y
 * pagos que llegaron sin ver su origen. Una conciliación o un saldo inicial no son pagos (regla 12: no bajan
 * lo que hay que pagar). Solo transacciones vigentes: una compra anulada después del corte no es un abono.
 */
const TIPOS_ABONO = ['pago_tarjeta', 'reembolso', 'ingreso', 'transferencia_pendiente'];

export function pagosPosterioresAlCorte(ctx: Contexto, tarjetaId: string, corte: PlainDate): Centavos {
  return ctx.db
    .select({ monto: asiento.monto })
    .from(asiento)
    .innerJoin(transaccionVigente, eq(transaccionVigente.id, asiento.transaccionId))
    .where(
      and(
        eq(asiento.cuentaId, tarjetaId),
        gt(transaccionVigente.fecha, corte),
        inArray(transaccionVigente.tipo, TIPOS_ABONO),
      ),
    )
    .all()
    .reduce((s, a) => s + Math.max(0, a.monto), 0);
}

function vista(ctx: Contexto, f: typeof estadoCuenta.$inferSelect): EstadoCuentaVista {
  const pagos = pagosPosterioresAlCorte(ctx, f.tarjetaId, f.corte);
  return {
    tarjetaId: f.tarjetaId,
    corte: f.corte,
    limite: f.limite,
    saldoCorte: f.saldoCorte,
    pagosPosteriores: pagos,
    pngi: pngiDe(f.saldoCorte, pagos),
  };
}

/** Estados de cuenta cerrados de una tarjeta, del más reciente al más antiguo. */
export function estadosDeCuenta(ctx: Contexto, tarjetaId: string): EstadoCuentaVista[] {
  return ctx.db
    .select()
    .from(estadoCuenta)
    .where(eq(estadoCuenta.tarjetaId, tarjetaId))
    .orderBy(desc(estadoCuenta.corte))
    .all()
    .map((f) => vista(ctx, f));
}

/** El último estado de cuenta cerrado (PNGI del último corte), o `null` si todavía no hay ninguno. */
export function ultimoEstadoCuenta(ctx: Contexto, tarjetaId: string): EstadoCuentaVista | null {
  const f = ctx.db
    .select()
    .from(estadoCuenta)
    .where(eq(estadoCuenta.tarjetaId, tarjetaId))
    .orderBy(desc(estadoCuenta.corte))
    .limit(1)
    .get();
  return f ? vista(ctx, f) : null;
}

/**
 * Reclasifica (E6.2, caso 6b) las cuotas de los planes activos de la tarjeta cuyo corte es `≤ hasta` y que
 * todavía no tienen su transacción `msi:{plan}:{k}`, cada una con la fecha de su corte. Un plan sin cuotas
 * pendientes queda `terminado`. Idempotente por la clave de cada cuota. Devuelve cuántas registró.
 */
export function reclasificarCuotasHasta(ctx: Contexto, t: TarjetaLeida, hasta: PlainDate): number {
  let registradas = 0;
  for (const plan of planesVigentes(ctx, { tarjetaId: t.cuentaId, estados: ['activo'] })) {
    const cuotas = cuotasDePlan(ctx, plan, t.ciclo);
    for (const c of cuotas) {
      if (c.estado !== 'por_facturar' || c.corte > hasta) continue;
      const mov = construirReclasificacionMsi({
        planId: plan.id,
        k: c.n,
        cuentaMsi: plan.cuentaMsiId,
        tarjeta: t.cuentaId,
        cuota: c.monto,
      });
      const r = ctx.libro.registrar({
        tipo: mov.tipo,
        fecha: c.corte,
        origen: 'sistema',
        claveIdempotencia: mov.claveIdempotencia as string,
        asientos: mov.asientos,
        descripcion: plan.descripcion,
      });
      if (r.nueva) registradas++;
    }
    if (cuotas.every((c) => c.estado === 'facturada' || c.corte <= hasta)) {
      ctx.db.update(planMsi).set({ estado: 'terminado' }).where(eq(planMsi.id, plan.id)).run();
    }
  }
  return registradas;
}

export interface CorteCerrado {
  readonly tarjetaId: string;
  readonly corte: PlainDate;
  readonly limite: PlainDate;
  readonly saldoCorte: Centavos;
  /** Cuotas MSI reclasificadas en este corte. */
  readonly reclasificaciones: number;
}

/**
 * E5.3 · Cierre de periodo, idempotente (al abrir la app y en Hoy, `03 §5.6`): por cada tarjeta, los cortes de
 * `cortesAProcesar` (posteriores al alta, `≤ hoy`, sin `estado_cuenta`), en orden; por cada uno, en una
 * transacción SQLite: reclasificación de las cuotas MSI de ese corte y `estado_cuenta` con el revolvente al
 * corte. Nunca procesa un corte anterior o igual al alta. Repetirlo no duplica nada.
 */
export function procesarCortes(ctx: Contexto): CorteCerrado[] {
  const hoy = ctx.reloj.hoy();
  const cerrados: CorteCerrado[] = [];
  for (const t of tarjetasActivas(ctx)) {
    const procesados = ctx.db
      .select({ corte: estadoCuenta.corte })
      .from(estadoCuenta)
      .where(eq(estadoCuenta.tarjetaId, t.cuentaId))
      .all()
      .map((f) => f.corte);
    for (const corte of cortesAProcesar(t.ciclo, inicioCortes(ctx, t), hoy, procesados)) {
      const cerrado = enTransaccion(ctx, () => {
        const reclasificaciones = reclasificarCuotasHasta(ctx, t, corte);
        const limite = limiteDe(t.ciclo, corte);
        const saldoCorte = -ctx.libro.saldo(t.cuentaId, corte);
        const r = ctx.db
          .insert(estadoCuenta)
          .values({ tarjetaId: t.cuentaId, corte, limite, saldoCorte, procesadoEn: ctx.reloj.ahora() })
          .onConflictDoNothing()
          .run() as { changes?: number };
        return Number(r.changes ?? 0) > 0
          ? { tarjetaId: t.cuentaId, corte, limite, saldoCorte, reclasificaciones }
          : null;
      });
      if (cerrado) cerrados.push(cerrado);
    }
  }
  return cerrados;
}

/**
 * Recalcula el `saldo_corte` de los cortes ya cerrados desde `desde` (pasar a meses una compra de un periodo
 * cerrado cambia lo que el banco facturó: la compra sale del revolvente y entra la cuota de ese corte).
 * `estado_cuenta` no es parte del libro: el libro sigue sin editarse.
 */
export function recalcularCortesDesde(ctx: Contexto, tarjetaId: string, desde: PlainDate): void {
  const t = tarjetaPorId(ctx, tarjetaId);
  const cortes = ctx.db
    .select({ corte: estadoCuenta.corte })
    .from(estadoCuenta)
    .where(and(eq(estadoCuenta.tarjetaId, tarjetaId), gte(estadoCuenta.corte, desde)))
    .orderBy(asc(estadoCuenta.corte))
    .all();
  for (const { corte } of cortes) {
    ctx.db
      .update(estadoCuenta)
      .set({ saldoCorte: -ctx.libro.saldo(t.cuentaId, corte) })
      .where(and(eq(estadoCuenta.tarjetaId, tarjetaId), eq(estadoCuenta.corte, corte)))
      .run();
  }
}

/** El último corte cerrado de la tarjeta (o `null`). */
export function ultimoCorteCerrado(ctx: Contexto, tarjetaId: string): PlainDate | null {
  return (
    ctx.db
      .select({ corte: estadoCuenta.corte })
      .from(estadoCuenta)
      .where(eq(estadoCuenta.tarjetaId, tarjetaId))
      .orderBy(desc(estadoCuenta.corte))
      .limit(1)
      .get()?.corte ?? null
  );
}
