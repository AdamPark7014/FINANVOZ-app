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

const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const MESES_LARGOS = [
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

/** "jueves". */
export function diaLargo(fecha: PlainDate): string {
  return DIAS_LARGOS[diaSemana(fecha) - 1] as string;
}

/** "enero". */
export function mesLargo(fecha: PlainDate): string {
  return MESES_LARGOS[partes(fecha).mes - 1] as string;
}

/** "10,000". */
export function miles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Cifra para frases armadas en servicios ("Comprometes $500 al mes"): `$1,500` sin centavos si son .00 y
 * `$1,099.90` con ellos (mismo criterio que `ui/formato` en modo `auto`).
 */
export function pesos(centavos: number): string {
  const abs = Math.abs(centavos);
  const resto = abs % 100;
  const texto = `$${miles(Math.floor(abs / 100))}${resto === 0 ? '' : `.${String(resto).padStart(2, '0')}`}`;
  return centavos < 0 ? `−${texto}` : texto;
}
