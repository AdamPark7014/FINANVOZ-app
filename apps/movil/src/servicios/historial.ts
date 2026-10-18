import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import {
  construirHistorial,
  ErrorDominio,
  maxFecha,
  sumarDias,
  VENTANA_HISTORIAL,
  type DiaHistorial,
  type PlainDate,
  type TransaccionHistorial,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { enTransaccion, type Contexto } from './contexto';
import { listarOcurrencias } from './ocurrencias';

const { transaccionVigente, transaccion, arqueo, auditoria, asiento, cuenta, ocurrencia } = esquema;

/** Tipos que pueden aportar consumo a E8 (`04 §3.1`); el resto se descarta sin leer sus asientos. */
const TIPOS_CONSUMO = ['gasto', 'cuenta_dividida', 'ajuste_arqueo', 'reembolso'];

/**
 * Primer día completo de uso: el día siguiente al `saldo_inicial` más antiguo (el día del onboarding ya traía
 * gastos que no se registraron). Sin saldos iniciales, el día siguiente a la transacción más antigua; sin nada,
 * hoy (0 días de historial). Así nunca se cuentan días incompletos como días de consumo bajo (regla 12).
 */
export function inicioUso(ctx: Contexto): PlainDate {
  const minimo = (soloSaldoInicial: boolean) =>
    ctx.db
      .select({ fecha: sql<string | null>`min(${transaccion.fecha})` })
      .from(transaccion)
      .where(soloSaldoInicial ? eq(transaccion.tipo, 'saldo_inicial') : sql`1 = 1`)
      .get()?.fecha ?? null;
  const primera = minimo(true) ?? minimo(false);
  return primera ? sumarDias(primera, 1) : ctx.reloj.hoy();
}

/**
 * Transacciones vigentes (`transaccion_vigente`: ni anuladas ni reversas; de un reemplazo, solo la nueva) con
 * fecha en `[desde, hasta]`, en la forma de E8.2: `monto_gasto` = Σ de asientos en cuentas de gasto del espacio
 * personal, si cubrió una ocurrencia, si es extraordinaria y, en los arqueos, la fecha del arqueo anterior.
 */
export function transaccionesHistorial(
  ctx: Contexto,
  desde: PlainDate,
  hasta: PlainDate,
): TransaccionHistorial[] {
  const filtroConsumo = and(
    inArray(transaccionVigente.tipo, TIPOS_CONSUMO),
    gte(transaccionVigente.fecha, desde),
    lte(transaccionVigente.fecha, hasta),
  );

  const filas = ctx.db
    .select({
      id: transaccionVigente.id,
      fecha: transaccionVigente.fecha,
      tipo: transaccionVigente.tipo,
      extraordinaria: transaccionVigente.extraordinaria,
    })
    .from(transaccionVigente)
    .where(filtroConsumo)
    .orderBy(asc(transaccionVigente.fecha), asc(transaccionVigente.id))
    .all();

  const montosPorTx = new Map(
    ctx.db
      .select({
        transaccionId: asiento.transaccionId,
        total: sql<number>`coalesce(sum(${asiento.monto}), 0)`,
      })
      .from(asiento)
      .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
      .innerJoin(transaccionVigente, eq(transaccionVigente.id, asiento.transaccionId))
      .where(and(eq(cuenta.naturaleza, 'gasto'), eq(cuenta.espacio, 'personal'), filtroConsumo))
      .groupBy(asiento.transaccionId)
      .all()
      .map((f) => [f.transaccionId, Number(f.total)] as const),
  );

  const cubreOcurrencia = new Set(
    ctx.db
      .select({ transaccionId: ocurrencia.transaccionId })
      .from(ocurrencia)
      .innerJoin(transaccionVigente, eq(transaccionVigente.id, ocurrencia.transaccionId))
      .where(and(eq(ocurrencia.estado, 'cubierta'), filtroConsumo))
      .all()
      .map((f) => f.transaccionId)
      .filter((id): id is string => id !== null),
  );

  return filas.map((f) => ({
    fecha: f.fecha,
    tipo: f.tipo,
    monto_gasto: montosPorTx.get(f.id) ?? 0,
    ...(cubreOcurrencia.has(f.id) ? { cubre_ocurrencia: true } : {}),
    ...(f.extraordinaria === 1 ? { extraordinaria: true } : {}),
    ...(f.tipo === 'ajuste_arqueo' ? { arqueo_anterior: arqueoAnterior(ctx, f.id) } : {}),
  }));
}

/** Fecha del arqueo anterior (de la misma cuenta) al que generó este ajuste; `null` si fue el primero. */
function arqueoAnterior(ctx: Contexto, transaccionId: string): PlainDate | null {
  const propio = ctx.db.select().from(arqueo).where(eq(arqueo.transaccionId, transaccionId)).get();
  if (!propio) return null;
  const previo = ctx.db
    .select({ fecha: arqueo.fecha })
    .from(arqueo)
    .where(and(eq(arqueo.cuentaId, propio.cuentaId), lt(arqueo.realizadoEn, propio.realizadoEn)))
    .orderBy(desc(arqueo.realizadoEn))
    .get();
  return previo?.fecha ?? null;
}

/** Fechas de ocurrencias de ingreso ya recibidas (clase `pago`). */
export function fechasIngresoRecibidas(ctx: Contexto): PlainDate[] {
  return [
    ...new Set(listarOcurrencias(ctx, { tipo: 'ingreso', estado: 'cubierta' }).map((o) => o.fecha)),
  ].sort();
}

export interface HistorialSimulacion {
  readonly historial: DiaHistorial[];
  readonly inicioUso: PlainDate;
  readonly fechasIngreso: readonly PlainDate[];
  /** Hoy es una ocurrencia de ingreso recibida hoy (E8.3). */
  readonly hoyEsDiaDePago: boolean;
}

/** E8.2 sobre el libro: un día por fecha completa en `[max(inicio_uso, hoy − 90), hoy)`. */
export function historialSimulacion(ctx: Contexto, hoy: PlainDate = ctx.reloj.hoy()): HistorialSimulacion {
  const inicio = inicioUso(ctx);
  const desde = maxFecha(inicio, sumarDias(hoy, -VENTANA_HISTORIAL));
  const fechasIngreso = fechasIngresoRecibidas(ctx);
  // Un arqueo de hoy reparte hacia días anteriores: se leen hasta hoy inclusive.
  const historial = construirHistorial(transaccionesHistorial(ctx, desde, hoy), inicio, hoy, fechasIngreso);
  return { historial, inicioUso: inicio, fechasIngreso, hoyEsDiaDePago: fechasIngreso.includes(hoy) };
}

/**
 * "Fue algo extraordinario" (`04 §3`): marca o desmarca una transacción para que no entre al historial de E8.2.
 * Es un campo editable sin reversa: se cambia en su lugar y deja registro en `auditoria`.
 */
export function marcarExtraordinaria(ctx: Contexto, transaccionId: string, extraordinaria: boolean): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const fila = ctx.db
      .select({ valor: transaccion.extraordinaria })
      .from(transaccion)
      .where(eq(transaccion.id, transaccionId))
      .get();
    if (!fila) throw new ErrorDominio('transaccion_inexistente', 'ese movimiento no existe');
    const valor = extraordinaria ? 1 : 0;
    if (fila.valor === valor) return;
    ctx.db.update(transaccion).set({ extraordinaria: valor }).where(eq(transaccion.id, transaccionId)).run();
    ctx.db
      .insert(auditoria)
      .values({
        id: ctx.generarId(),
        en: ctx.reloj.ahora(),
        entidad: 'transaccion',
        entidadId: transaccionId,
        accion: 'extraordinaria',
        antes: JSON.stringify({ extraordinaria: fila.valor }),
        despues: JSON.stringify({ extraordinaria: valor }),
      })
      .run();
  });
}
