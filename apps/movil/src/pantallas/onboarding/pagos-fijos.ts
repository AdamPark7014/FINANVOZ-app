import { proximasFechas, type Centavos, type DiaSemana, type PlainDate, type Regla } from '@cartera/core';
import { leerEntero, OPCIONES_DIA_SEMANA } from './ingreso';

/**
 * O5 · Pagos fijos (`02 §3`): traduce las respuestas de la pantalla a la regla que entiende `servicios/` y
 * arma las etiquetas de la lista. Solo mapeo y texto; las fechas y el apartado los calculan `core` y `servicios`.
 */

export type FrecuenciaPago = 'mensual' | 'quincenal' | 'semanal' | 'anual';

export const OPCIONES_FRECUENCIA_PAGO: readonly { valor: FrecuenciaPago; etiqueta: string }[] = [
  { valor: 'mensual', etiqueta: 'Cada mes' },
  { valor: 'quincenal', etiqueta: 'Cada quincena' },
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'anual', etiqueta: 'Cada año' },
];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export const OPCIONES_MES: readonly { valor: number; etiqueta: string }[] = MESES.map((m, i) => ({
  valor: i + 1,
  etiqueta: m.charAt(0).toUpperCase() + m.slice(1, 3),
}));

export interface RespuestasPago {
  frecuencia: FrecuenciaPago;
  /** Día del mes escrito a mano (mensual y anual). */
  diaMes: string;
  diaSemana: DiaSemana | null;
  mes: number | null;
  /** Cuántos pagos faltan, escrito a mano; vacío = sin fin. */
  pagosRestantes: string;
}

export const RESPUESTAS_PAGO_INICIALES: RespuestasPago = {
  frecuencia: 'mensual',
  diaMes: '',
  diaSemana: null,
  mes: null,
  pagosRestantes: '',
};

/** `null` si falta un dato de la frecuencia elegida. */
export function reglaDePago(r: RespuestasPago): Regla | null {
  switch (r.frecuencia) {
    case 'mensual': {
      const dia = leerEntero(r.diaMes, 1, 31);
      return dia === null ? null : { tipo: 'mensual', dia };
    }
    case 'quincenal':
      return { tipo: 'quincenal_15_ultimo' };
    case 'semanal':
      return r.diaSemana === null ? null : { tipo: 'semanal', dia_semana: r.diaSemana };
    case 'anual': {
      const dia = leerEntero(r.diaMes, 1, 31);
      return r.mes === null || dia === null ? null : { tipo: 'anual', mes: r.mes, dia };
    }
  }
}

/** Número de pagos que faltan (1–999) o `null` si está vacío; `undefined` si está escrito pero no vale. */
export function leerPagosRestantes(texto: string): number | null | undefined {
  if (texto.trim() === '') return null;
  return leerEntero(texto, 1, 999) ?? undefined;
}

/** Fecha del último pago cuando se sabe cuántos faltan: la n-ésima ocurrencia desde hoy (`hasta` inclusivo). */
export function hastaDePago(regla: Regla, hoy: PlainDate, pagosRestantes: number): PlainDate | null {
  return proximasFechas(regla, hoy, pagosRestantes)[pagosRestantes - 1] ?? null;
}

/**
 * Cuánto representa al mes, para el total de la pantalla. Redondea hacia arriba (regla 12: ante la duda,
 * contar de más lo que se debe). Solo para mostrar: el apartado real lo hace E4 ocurrencia por ocurrencia.
 */
export function equivalenteMensual(monto: Centavos, regla: Regla): Centavos {
  switch (regla.tipo) {
    case 'mensual':
    case 'unica':
      return monto;
    case 'quincenal_15_ultimo':
    case 'quincenal_dias':
      return monto * 2;
    case 'catorcenal':
      return Math.ceil((monto * 26) / 12);
    case 'semanal':
      return Math.ceil((monto * 52) / 12);
    case 'anual':
      return Math.ceil(monto / 12);
  }
}

export function totalMensual(pagos: readonly { monto: Centavos; regla: Regla }[]): Centavos {
  return pagos.reduce((suma, p) => suma + equivalenteMensual(p.monto, p.regla), 0);
}

/** "día 5 de cada mes", "los días 15 y último", "cada lunes", "cada 5 de marzo". */
export function describirRegla(regla: Regla): string {
  switch (regla.tipo) {
    case 'mensual':
      return `día ${regla.dia} de cada mes`;
    case 'quincenal_15_ultimo':
      return 'los días 15 y último';
    case 'quincenal_dias':
      return `los días ${regla.dias[0]} y ${regla.dias[1]}`;
    case 'semanal': {
      const dia = OPCIONES_DIA_SEMANA.find((d) => d.valor === regla.dia_semana)?.etiqueta ?? '';
      return `cada ${dia.toLowerCase()}`;
    }
    case 'catorcenal':
      return 'cada 14 días';
    case 'anual':
      return `cada ${regla.dia} de ${MESES[regla.mes - 1] ?? ''}`;
    case 'unica':
      return 'una sola vez';
  }
}

/** Nombre del pago como lo escribió la persona: sin espacios sobrantes, 1–60 caracteres (como `servicios/`). */
export function limpiarNombrePago(texto: string): string | null {
  const t = texto.trim().replace(/\s+/g, ' ');
  return t.length >= 1 && t.length <= 60 ? t : null;
}

/** "Renta", "Luz"… para chips y lista. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
