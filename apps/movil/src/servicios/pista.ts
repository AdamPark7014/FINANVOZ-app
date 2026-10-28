import { diaSemana, diferenciaDias, partes, sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import type { Contexto } from './contexto';
import { listarOcurrencias } from './ocurrencias';
import { listarTarjetas } from './vista-tarjetas';

/** Lo que cae en un día de la pista: un pago fijo, el pago de una tarjeta o un ingreso. */
export interface EventoPista {
  readonly tipo: 'egreso' | 'tarjeta' | 'ingreso';
  /** «internet», «Nu», «quincena» (como lo nombró la persona). */
  readonly concepto: string;
  readonly monto: Centavos;
}

export interface DiaPista {
  readonly fecha: PlainDate;
  /** «lun», «mié». */
  readonly diaSemana: string;
  /** Día del mes. */
  readonly dia: number;
  readonly hoy: boolean;
  /** El día del ingreso que cierra la pista. */
  readonly ingreso: boolean;
  readonly eventos: readonly EventoPista[];
}

/** La pista a la quincena (dirección B+, D1): los días hasta el próximo ingreso con lo que cae en cada uno. */
export interface PistaQuincena {
  /** Días de hoy al ingreso («4 días»). */
  readonly diasAlIngreso: number;
  readonly concepto: string;
  readonly columnas: readonly DiaPista[];
  /** Entre hoy y el ingreso hay días que no se ven (sin nada fijo o más de los que caben). */
  readonly recortada: boolean;
}

/** Columnas que caben a lo ancho de un teléfono (D1: cinco círculos). */
export const COLUMNAS_PISTA = 5;

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

/**
 * Arma las columnas de la pista, sin I/O: de `hoy` a `fin` (el día del ingreso) si caben; si no, hoy, los días con
 * algo fijo (los primeros que quepan) y el del ingreso. Lo que cae fuera de `[hoy, fin]` no entra.
 */
export function armarPista(
  hoy: PlainDate,
  fin: PlainDate,
  eventos: readonly (EventoPista & { readonly fecha: PlainDate })[],
  maxColumnas = COLUMNAS_PISTA,
): { columnas: DiaPista[]; recortada: boolean } {
  const total = diferenciaDias(hoy, fin) + 1;
  if (total < 1) return { columnas: [], recortada: false };
  const porDia = new Map<PlainDate, EventoPista[]>();
  for (const e of eventos) {
    if (e.fecha < hoy || e.fecha > fin) continue;
    porDia.set(e.fecha, [
      ...(porDia.get(e.fecha) ?? []),
      { tipo: e.tipo, concepto: e.concepto, monto: e.monto },
    ]);
  }
  const todas = Array.from({ length: total }, (_, i) => sumarDias(hoy, i));
  let fechas: PlainDate[];
  let recortada = false;
  if (total <= maxColumnas) {
    fechas = todas;
  } else {
    const intermedios = todas.slice(1, -1).filter((f) => porDia.has(f));
    fechas = [hoy, ...intermedios.slice(0, Math.max(0, maxColumnas - 2)), fin];
    recortada = true;
  }
  const columnas = fechas.map((fecha) => ({
    fecha,
    diaSemana: DIAS[diaSemana(fecha) - 1] as string,
    dia: partes(fecha).dia,
    hoy: fecha === hoy,
    ingreso: fecha === fin,
    eventos: porDia.get(fecha) ?? [],
  }));
  return { columnas, recortada };
}

/**
 * La pista hasta `fin` (el próximo ingreso de Hoy, `VistaHoy.proximoIngreso`): pagos fijos e ingresos pendientes y
 * el pago para no generar intereses de cada tarjeta que vence en el camino. Sin cálculos nuevos: las cifras son las
 * de las ocurrencias y de E5 (`listarTarjetas`).
 */
export function pistaQuincena(ctx: Contexto, fin: { fecha: PlainDate; concepto: string }): PistaQuincena {
  const hoy = ctx.reloj.hoy();
  const eventos: (EventoPista & { fecha: PlainDate })[] = listarOcurrencias(ctx, { estado: 'pendiente' })
    .filter((o) => o.fecha >= hoy && o.fecha <= fin.fecha && o.monto > 0)
    .map((o) => ({
      fecha: o.fecha,
      tipo: o.tipo === 'ingreso' ? ('ingreso' as const) : ('egreso' as const),
      concepto: o.concepto,
      monto: o.monto,
    }));
  for (const t of listarTarjetas(ctx)) {
    if (t.pngi <= 0 || t.fechaLimite < hoy || t.fechaLimite > fin.fecha) continue;
    eventos.push({ fecha: t.fechaLimite, tipo: 'tarjeta', concepto: t.nombre, monto: t.pngi });
  }
  const { columnas, recortada } = armarPista(hoy, fin.fecha, eventos);
  return { diasAlIngreso: diferenciaDias(hoy, fin.fecha), concepto: fin.concepto, columnas, recortada };
}
