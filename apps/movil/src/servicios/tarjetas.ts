import { and, eq, inArray } from 'drizzle-orm';
import {
  claveCuotaMsi,
  distribuirMayorResiduo,
  limiteDe,
  siguienteCorte,
  type Centavos,
  type CuotaMsi,
  type PlainDate,
  type TarjetaCredito,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import type { Contexto } from './contexto';

const { cuenta, tarjeta, planMsi, transaccion } = esquema;

export interface TarjetaLeida {
  readonly cuentaId: string;
  readonly nombre: string;
  readonly ultimos4: string | null;
  readonly modo: 'totalero' | 'plan';
  readonly limiteCredito: Centavos;
  readonly alta: PlainDate;
  readonly ciclo: TarjetaCredito;
  /** Deuda revolvente (sin MSI no facturados); negativa = saldo a favor. */
  readonly saldoRevolvente: Centavos;
}

function ciclo(f: typeof tarjeta.$inferSelect): TarjetaCredito {
  return f.diasParaPagar !== null
    ? { diaCorte: f.diaCorte, diasParaPagar: f.diasParaPagar }
    : { diaCorte: f.diaCorte, diaLimitePago: f.diaLimitePago as number };
}

/** Tarjetas de crédito activas del espacio personal. */
export function tarjetasActivas(ctx: Contexto): TarjetaLeida[] {
  return ctx.db
    .select({ c: cuenta, t: tarjeta })
    .from(tarjeta)
    .innerJoin(cuenta, eq(cuenta.id, tarjeta.cuentaId))
    .where(and(eq(cuenta.archivada, 0), eq(cuenta.espacio, 'personal')))
    .all()
    .map(({ c, t }) => ({
      cuentaId: c.id,
      nombre: c.nombre,
      ultimos4: c.ultimos4,
      modo: t.modo,
      limiteCredito: t.limiteCredito,
      alta: t.alta,
      ciclo: ciclo(t),
      saldoRevolvente: -ctx.libro.saldo(c.id),
    }));
}

export interface CuotaPendiente extends CuotaMsi {
  readonly planId: string;
  readonly tarjetaId: string;
}

/**
 * Cuotas MSI aún no reclasificadas (sin transacción `msi:{plan}:{k}`) de los planes activos (E6.1): la cuota k
 * vale `distribuirMayorResiduo(monto, [1 × meses])[k−1]` y se factura en el corte k−1 posterior a
 * `primer_corte`. El cierre de cortes llega en M4; hasta entonces todas siguen "no facturadas".
 */
export function cuotasMsiPendientes(ctx: Contexto): CuotaPendiente[] {
  const planes = ctx.db
    .select({ p: planMsi, t: tarjeta })
    .from(planMsi)
    .innerJoin(tarjeta, eq(tarjeta.cuentaId, planMsi.tarjetaId))
    .where(eq(planMsi.estado, 'activo'))
    .all();
  if (planes.length === 0) return [];
  const claves = planes.flatMap(({ p }) =>
    Array.from({ length: p.meses }, (_, i) => claveCuotaMsi(p.id, i + 1)),
  );
  const hechas = new Set(
    ctx.db
      .select({ clave: transaccion.claveIdempotencia })
      .from(transaccion)
      .where(inArray(transaccion.claveIdempotencia, claves))
      .all()
      .map((f) => f.clave),
  );
  const salida: CuotaPendiente[] = [];
  for (const { p, t } of planes) {
    const c = ciclo(t);
    const montos = distribuirMayorResiduo(
      p.monto,
      Array.from({ length: p.meses }, () => 1),
    );
    let corte = p.primerCorte;
    montos.forEach((monto, i) => {
      if (!hechas.has(claveCuotaMsi(p.id, i + 1))) {
        salida.push({
          planId: p.id,
          tarjetaId: p.tarjetaId,
          n: i + 1,
          monto,
          corte,
          limite: limiteDe(c, corte),
        });
      }
      corte = siguienteCorte(c, corte);
    });
  }
  return salida;
}
