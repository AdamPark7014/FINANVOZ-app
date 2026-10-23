import {
  conDia,
  diaSemana,
  diferenciaDias,
  partes,
  sumarDias,
  sumarMeses,
  type PlainDate,
} from '@cartera/core';
import type {
  PeriodoComparar,
  PeriodoGasto,
  PeriodoPagos,
  RangoFechas,
  ResolverPeriodos,
} from '@cartera/nlu';
import type { Contexto } from './contexto';
import { listarOcurrencias } from './ocurrencias';
import { proximoPago } from './onboarding';
import { ingresoPrincipal } from './programados';

/**
 * Periodos con nombre del modo explicar (`06 §6`): "esta quincena", "la semana pasada", "los próximos 7 días". Los
 * resuelve el teléfono con su fecha y los días de pago de su ingreso principal, para que el modelo no cuente días
 * ni adivine cuándo empezó la quincena. Puro sobre el libro: solo lee.
 */

const r = (desde: PlainDate, hasta: PlainDate): RangoFechas => ({ desde, hasta });
const menor = (a: PlainDate, b: PlainDate) => (a < b ? a : b);

/** Días de pago alrededor de hoy: el último recibido (≤ hoy), el anterior a ese y el próximo (> hoy). */
function quincena(ctx: Contexto, hoy: PlainDate) {
  const ingreso = ingresoPrincipal(ctx);
  if (!ingreso) return null;
  const pasados = listarOcurrencias(ctx, { programadoId: ingreso.id })
    .map((o) => o.fecha)
    .filter((f) => f <= hoy)
    .sort();
  const ultimo = pasados[pasados.length - 1] ?? null;
  const proximo = proximoPago(ingreso.regla, sumarDias(hoy, 1));
  // Sin el penúltimo en el libro, la quincena pasada mide lo mismo que la actual.
  const penultimo =
    pasados[pasados.length - 2] ??
    (ultimo && proximo ? sumarDias(ultimo, -diferenciaDias(ultimo, proximo)) : null);
  return { ultimo, penultimo, proximo };
}

export function resolverPeriodos(ctx: Contexto): ResolverPeriodos {
  const hoy = ctx.reloj.hoy();
  const lunes = sumarDias(hoy, 1 - diaSemana(hoy));
  const inicioMes = conDia(partes(hoy).anio, partes(hoy).mes, 1);
  const inicioMesPasado = sumarMeses(inicioMes, -1);
  const finMes = sumarDias(sumarMeses(inicioMes, 1), -1);
  let q: ReturnType<typeof quincena> | undefined;
  const pagos = () => (q === undefined ? (q = quincena(ctx, hoy)) : q);

  return {
    gasto(periodo: PeriodoGasto) {
      switch (periodo) {
        case 'hoy':
          return r(hoy, hoy);
        case 'ayer':
          return r(sumarDias(hoy, -1), sumarDias(hoy, -1));
        case 'esta_semana':
          return r(lunes, hoy);
        case 'semana_pasada':
          return r(sumarDias(lunes, -7), sumarDias(lunes, -1));
        case 'esta_quincena': {
          const u = pagos()?.ultimo;
          return u ? r(u, hoy) : null;
        }
        case 'quincena_pasada': {
          const p = pagos();
          return p?.ultimo && p.penultimo ? r(p.penultimo, sumarDias(p.ultimo, -1)) : null;
        }
        case 'este_mes':
          return r(inicioMes, hoy);
        case 'mes_pasado':
          return r(inicioMesPasado, sumarDias(inicioMes, -1));
        case 'ultimos_30_dias':
          return r(sumarDias(hoy, -29), hoy);
      }
    },
    pagos(periodo: PeriodoPagos) {
      switch (periodo) {
        case 'hoy':
          return r(hoy, hoy);
        case 'esta_semana':
          return r(hoy, sumarDias(lunes, 6));
        case 'esta_quincena': {
          const p = pagos()?.proximo;
          return p ? r(hoy, sumarDias(p, -1)) : null;
        }
        case 'este_mes':
          return r(hoy, finMes);
        case 'proximos_7_dias':
          return r(hoy, sumarDias(hoy, 6));
        case 'proximos_30_dias':
          return r(hoy, sumarDias(hoy, 29));
      }
    },
    comparar(periodo: PeriodoComparar) {
      switch (periodo) {
        case 'este_mes':
          return { actual: r(inicioMes, hoy), anterior: r(inicioMesPasado, sumarMeses(hoy, -1)) };
        case 'esta_semana':
          return { actual: r(lunes, hoy), anterior: r(sumarDias(lunes, -7), sumarDias(hoy, -7)) };
        case 'esta_quincena': {
          const p = pagos();
          if (!p?.ultimo || !p.penultimo) return null;
          const fin = menor(sumarDias(p.penultimo, diferenciaDias(p.ultimo, hoy)), sumarDias(p.ultimo, -1));
          return { actual: r(p.ultimo, hoy), anterior: r(p.penultimo, fin) };
        }
      }
    },
  };
}
