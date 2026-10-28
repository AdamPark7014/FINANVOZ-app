import { and, gte, inArray, lte, ne } from 'drizzle-orm';
import { sumarDias, type PlainDate } from '@cartera/core';
import { esquema } from '@cartera/datos';
import type { Contexto } from './contexto';

const { transaccionVigente: tv } = esquema;

/** La racha se dice desde 3 días seguidos (B+, D3: «6 días seguidos anotando todo»). */
export const RACHA_MINIMA = 3;

/** Hasta dónde se busca hacia atrás (una racha más larga se dice como la más larga que cabe). */
const VENTANA_DIAS = 366;

/** Lo que anota la persona: voz, texto y formulario (las capturas automáticas y el sistema no cuentan). */
const ORIGENES_PROPIOS = ['voz', 'texto', 'manual'] as const;

/**
 * Días seguidos con al menos un movimiento, contando hacia atrás desde `hoy` (o desde ayer, si hoy todavía no hay
 * nada: la racha sigue viva hasta que acabe el día). Pura: recibe las fechas, sin reloj ni base.
 */
export function diasSeguidos(fechas: Iterable<PlainDate>, hoy: PlainDate): number {
  const con = new Set(fechas);
  let dia = con.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (con.has(dia) && n < VENTANA_DIAS) {
    n++;
    dia = sumarDias(dia, -1);
  }
  return n;
}

/**
 * La racha de días seguidos anotando (B+, D3): días con algún movimiento vigente que registró la persona (voz, texto o
 * formulario), por su fecha. Las capturas automáticas no cuentan: la racha es del hábito de anotar.
 */
export function rachaAnotando(ctx: Contexto): number {
  const hoy = ctx.reloj.hoy();
  const fechas = ctx.db
    .selectDistinct({ fecha: tv.fecha })
    .from(tv)
    .where(
      and(
        ne(tv.tipo, 'saldo_inicial'),
        inArray(tv.origen, [...ORIGENES_PROPIOS]),
        gte(tv.fecha, sumarDias(hoy, -VENTANA_DIAS)),
        lte(tv.fecha, hoy),
      ),
    )
    .all()
    .map((f) => f.fecha);
  return diasSeguidos(fechas, hoy);
}
