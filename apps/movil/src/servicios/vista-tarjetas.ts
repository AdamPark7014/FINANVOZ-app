import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import {
  corteDe,
  ErrorDominio,
  limiteDe,
  recomendarTarjeta,
  redondearPorcentaje,
  sumarDias,
  UMBRAL_USO_BP,
  type Centavos,
  type PlainDate,
  type TarjetaCredito,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { listarPagosPlaneados, type PagoPlaneadoVista } from './config-tarjetas';
import type { Contexto } from './contexto';
import { estadosDeCuenta, ultimoEstadoCuenta, type EstadoCuentaVista } from './cortes';
import { etiquetaFecha } from './formato';
import { registrarMovimiento, type MovimientoRegistrado } from './formulario';
import { listarMovimientos, type MovimientoVista } from './movimientos';
import { compromisoMsi12Meses, listarPlanesMsi, type MesCompromiso, type PlanMsiVista } from './msi';
import {
  cuotasMsiPendientes,
  msiPorPagar,
  tarjetaPorId,
  tarjetasActivas,
  type TarjetaLeida,
} from './tarjetas';

const { asiento, cuenta, transaccionVigente } = esquema;

/** Una fila de la pantalla Tarjetas (`02 §8`, RF-TAR-02). */
export interface TarjetaVista {
  readonly id: string;
  readonly nombre: string;
  readonly ultimos4: string | null;
  readonly modo: 'totalero' | 'plan';
  readonly limiteCredito: Centavos;
  /** Deuda revolvente; negativa = saldo a favor. */
  readonly saldoRevolvente: Centavos;
  /** Lo que falta de meses sin intereses (incluidas cuotas aún no facturadas). */
  readonly msiPorPagar: Centavos;
  /** Deuda total: revolvente (sin saldo a favor) + meses por pagar. */
  readonly deudaTotal: Centavos;
  /** "Saldo a favor $1,200" (no se suma a tu dinero libre, E4-07). */
  readonly saldoAFavor: Centavos;
  readonly disponible: Centavos;
  /** Uso del límite en puntos base (E5.2 sin compra); la barra marca 30 %. */
  readonly usoBp: number;
  /** Uso redondeado para mostrar ("71 %"). */
  readonly usoPorcentaje: number;
  /** Último estado de cuenta cerrado con su PNGI, o `null` si aún no cierra ninguno desde el alta. */
  readonly ultimoCorte: EstadoCuentaVista | null;
  /** PNGI del último corte (0 si no hay corte o ya se pagó). */
  readonly pngi: Centavos;
  /** Fecha límite que toca vigilar: la del último corte si no ha pasado; si no, la del próximo corte. */
  readonly fechaLimite: PlainDate;
  readonly etiquetaFechaLimite: string;
  readonly proximoCorte: PlainDate;
  readonly etiquetaProximoCorte: string;
  readonly planesActivos: number;
}

function usoBp(t: TarjetaLeida, msi: Centavos): number {
  if (t.limiteCredito <= 0) return 10000;
  return Number(((BigInt(Math.max(0, t.saldoRevolvente)) + BigInt(msi)) * 10000n) / BigInt(t.limiteCredito));
}

function vistaTarjeta(ctx: Contexto, t: TarjetaLeida): TarjetaVista {
  const hoy = ctx.reloj.hoy();
  const msi = msiPorPagar(ctx, t.cuentaId);
  const ultimo = ultimoEstadoCuenta(ctx, t.cuentaId);
  const proximoCorte = corteDe(t.ciclo, sumarDias(hoy, 1));
  const fechaLimite =
    ultimo && ultimo.limite >= hoy ? ultimo.limite : limiteDe(t.ciclo, corteDe(t.ciclo, hoy));
  const uso = usoBp(t, msi);
  const planes = new Set(cuotasMsiPendientes(ctx, t.cuentaId).map((c) => c.planId));
  return {
    id: t.cuentaId,
    nombre: t.nombre,
    ultimos4: t.ultimos4,
    modo: t.modo,
    limiteCredito: t.limiteCredito,
    saldoRevolvente: t.saldoRevolvente,
    msiPorPagar: msi,
    deudaTotal: Math.max(0, t.saldoRevolvente) + msi,
    saldoAFavor: Math.max(0, -t.saldoRevolvente),
    disponible: Math.max(0, t.limiteCredito - Math.max(0, t.saldoRevolvente) - msi),
    usoBp: uso,
    usoPorcentaje: redondearPorcentaje(uso, 10000),
    ultimoCorte: ultimo,
    pngi: ultimo?.pngi ?? 0,
    fechaLimite,
    etiquetaFechaLimite: etiquetaFecha(fechaLimite),
    proximoCorte,
    etiquetaProximoCorte: etiquetaFecha(proximoCorte),
    planesActivos: planes.size,
  };
}

/** Pantalla Tarjetas (`02 §8`): una fila por tarjeta activa, en orden de alta. */
export function listarTarjetas(ctx: Contexto): TarjetaVista[] {
  return tarjetasActivas(ctx).map((t) => vistaTarjeta(ctx, t));
}

/** Detalle de una tarjeta (`02 §8`). */
export interface DetalleTarjeta extends TarjetaVista {
  readonly alta: PlainDate;
  readonly ciclo: TarjetaCredito;
  readonly tasaAnualBp: number | null;
  /** Compras y pagos desde el último corte (o desde el alta). */
  readonly desdeElCorte: readonly MovimientoVista[];
  /** Estados de cuenta cerrados, del más reciente al más antiguo. */
  readonly estadosCuenta: readonly EstadoCuentaVista[];
  /** MSI de la tarjeta con su calendario (activos primero). */
  readonly planes: readonly PlanMsiVista[];
  /** Compromiso de meses de los próximos 12 meses (Plus en la UI). */
  readonly compromiso12Meses: readonly MesCompromiso[];
  /** Pagos planeados (solo modo plan). */
  readonly pagosPlaneados: readonly PagoPlaneadoVista[];
}

export function detalleTarjeta(ctx: Contexto, tarjetaId: string): DetalleTarjeta {
  const t = tarjetaPorId(ctx, tarjetaId);
  const base = vistaTarjeta(ctx, t);
  const desde = base.ultimoCorte ? sumarDias(base.ultimoCorte.corte, 1) : t.alta;
  return {
    ...base,
    alta: t.alta,
    ciclo: t.ciclo,
    tasaAnualBp: t.tasaAnualBp,
    desdeElCorte: listarMovimientos(ctx, { cuentaId: tarjetaId, desde }).flatMap((d) => d.movimientos),
    estadosCuenta: estadosDeCuenta(ctx, tarjetaId),
    planes: listarPlanesMsi(ctx, tarjetaId),
    compromiso12Meses: compromisoMsi12Meses(ctx, tarjetaId),
    pagosPlaneados: listarPagosPlaneados(ctx, tarjetaId),
  };
}

// ——— Pagar la tarjeta ———

/**
 * Pagar una tarjeta (tarjeta de acción "Ya la pagué" o la pantalla Tarjetas): `pago_tarjeta` desde `origenId`
 * por `monto` (por omisión, el PNGI del último corte; si es 0, la deuda revolvente). Cubre el pago planeado que
 * corresponda (E3.5) y, si deja saldo a favor con meses activos, trae la pregunta de liquidar.
 */
export function pagarTarjeta(
  ctx: Contexto,
  e: { tarjetaId: string; origenId: string; monto?: Centavos; fecha?: PlainDate },
): MovimientoRegistrado {
  const v = vistaTarjeta(ctx, tarjetaPorId(ctx, e.tarjetaId));
  const monto = e.monto ?? (v.pngi > 0 ? v.pngi : Math.max(0, v.saldoRevolvente));
  if (monto <= 0) throw new ErrorDominio('sin_deuda', 'esa tarjeta no tiene nada por pagar');
  return registrarMovimiento(ctx, {
    tipo: 'pago_tarjeta',
    monto,
    ...(e.fecha ? { fecha: e.fecha } : {}),
    origenId: e.origenId,
    destinoId: e.tarjetaId,
  });
}

// ——— Tarjeta del día (RF-HOY-04, E5.2) ———

/** Monto de la tarjeta del día cuando no hay compras con crédito en los últimos 60 días (E5.2). */
export const MONTO_TARJETA_DEL_DIA: Centavos = 50_000;
export const DIAS_HISTORIAL_TARJETA_DEL_DIA = 60;

export interface TarjetaDelDia {
  readonly tarjetaId: string;
  readonly nombre: string;
  /** Días para pagar una compra de hoy (E5.1). */
  readonly dias: number;
  readonly corte: PlainDate;
  readonly limite: PlainDate;
  readonly usoBp: number;
  readonly advertencia: 'uso_alto' | null;
  /** Monto supuesto: mediana de las compras con crédito de 60 días, o $500. */
  readonly monto: Centavos;
  /** "Si compras hoy, usa la Banamex Oro ••8812: tienes 50 días para pagar." */
  readonly texto: string;
}

/** Mediana de montos en centavos (con un número par, el piso del promedio de los dos de en medio). */
function mediana(montos: readonly Centavos[]): Centavos | null {
  if (montos.length === 0) return null;
  const o = [...montos].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? (o[m] as number) : Math.floor(((o[m - 1] as number) + (o[m] as number)) / 2);
}

/** Compras (gastos y compras a meses) cargadas a tarjetas de crédito en `[hoy − 60, hoy]`. */
function comprasConCredito(ctx: Contexto, hoy: PlainDate, tarjetas: readonly string[]): Centavos[] {
  if (tarjetas.length === 0) return [];
  return ctx.db
    .select({ monto: asiento.monto })
    .from(asiento)
    .innerJoin(transaccionVigente, eq(transaccionVigente.id, asiento.transaccionId))
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(
      and(
        inArray(transaccionVigente.tipo, ['gasto', 'cuenta_dividida']),
        inArray(asiento.cuentaId, [...tarjetas]),
        gte(transaccionVigente.fecha, sumarDias(hoy, -DIAS_HISTORIAL_TARJETA_DEL_DIA)),
        lte(transaccionVigente.fecha, hoy),
      ),
    )
    .all()
    .filter((a) => a.monto < 0)
    .map((a) => -a.monto);
}

/**
 * Tarjeta del día (CA-M4-03): E5.2 con una compra de hoy por la mediana de las compras con crédito de los últimos
 * 60 días ($500 si no hay). Solo se muestra con ≥ 2 tarjetas elegibles; `null` si no.
 */
export function tarjetaDelDia(ctx: Contexto): TarjetaDelDia | null {
  const hoy = ctx.reloj.hoy();
  const tarjetas = tarjetasActivas(ctx);
  const msi = new Map<string, Centavos>();
  for (const c of cuotasMsiPendientes(ctx)) msi.set(c.tarjetaId, (msi.get(c.tarjetaId) ?? 0) + c.monto);
  const monto =
    mediana(
      comprasConCredito(
        ctx,
        hoy,
        tarjetas.map((t) => t.cuentaId),
      ),
    ) ?? MONTO_TARJETA_DEL_DIA;
  const r = recomendarTarjeta(
    { fecha: hoy, monto },
    tarjetas.map((t) => ({
      ...t.ciclo,
      id: t.cuentaId,
      modo: t.modo,
      limiteCredito: t.limiteCredito,
      saldoRevolvente: t.saldoRevolvente,
      msiNoFacturado: msi.get(t.cuentaId) ?? 0,
    })),
  );
  const tope = r.advertencia === 'uso_alto' ? 10000 : UMBRAL_USO_BP;
  const elegibles = r.candidatas.filter((c) => c.usoBp <= tope).length;
  if (!r.tarjeta || elegibles < 2) return null;
  const elegida = r.tarjeta;
  const nombre = tarjetas.find((t) => t.cuentaId === elegida.id)?.nombre ?? '';
  const uso = redondearPorcentaje(elegida.usoBp, 10000);
  return {
    tarjetaId: elegida.id,
    nombre,
    dias: elegida.dias,
    corte: elegida.corte,
    limite: elegida.limite,
    usoBp: elegida.usoBp,
    advertencia: r.advertencia === 'uso_alto' ? 'uso_alto' : null,
    monto,
    texto:
      r.advertencia === 'uso_alto'
        ? `La que menos te afecta es la ${nombre}, pero quedarías en ${uso} % de uso.`
        : `Si compras hoy, usa la ${nombre}: tienes ${elegida.dias} días para pagar.`,
  };
}

// ——— Pago de tarjeta que vence (tarjeta de acción 1, `02 §4.1`) ———

export interface PagoQueVence {
  readonly tarjetaId: string;
  readonly nombre: string;
  readonly corte: PlainDate;
  readonly limite: PlainDate;
  readonly pngi: Centavos;
  /** `vencido`: la fecha límite ya pasó y queda PNGI. */
  readonly cuando: 'por_vencer' | 'vencido';
}

/** Tarjetas cuyo último corte tiene PNGI pendiente y fecha límite en ≤ 3 días (o ya vencida). */
export function pagosQueVencen(ctx: Contexto, dias = 3): PagoQueVence[] {
  const hoy = ctx.reloj.hoy();
  const salida: PagoQueVence[] = [];
  for (const t of tarjetasActivas(ctx)) {
    const ultimo = ultimoEstadoCuenta(ctx, t.cuentaId);
    if (!ultimo || ultimo.pngi <= 0 || ultimo.limite > sumarDias(hoy, dias)) continue;
    salida.push({
      tarjetaId: t.cuentaId,
      nombre: t.nombre,
      corte: ultimo.corte,
      limite: ultimo.limite,
      pngi: ultimo.pngi,
      cuando: ultimo.limite < hoy ? 'vencido' : 'por_vencer',
    });
  }
  return salida.sort((a, b) => (a.limite < b.limite ? -1 : a.limite > b.limite ? 1 : 0));
}
