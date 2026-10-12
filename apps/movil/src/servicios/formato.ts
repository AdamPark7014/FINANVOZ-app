import { diaSemana, partes, type PlainDate } from '@cartera/core';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** "jue 15" (`02 §4`): día de la semana abreviado y día del mes. */
export function etiquetaFecha(fecha: PlainDate): string {
  return `${DIAS[diaSemana(fecha) - 1]} ${partes(fecha).dia}`;
}

/** "11 oct" para listas de movimientos. */
export function etiquetaDiaMes(fecha: PlainDate): string {
  const { mes, dia } = partes(fecha);
  return `${dia} ${MESES[mes - 1]}`;
}

/** "1 día" / "4 días". */
export function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}
