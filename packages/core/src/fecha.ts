import { ErrorDominio } from './errores';

/** Fecha civil `'YYYY-MM-DD'` (regla 6). Toda la aritmética es entera; nunca se usa `Date`. */
export type PlainDate = string;

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ModoFinDeSemana = 'anterior' | 'siguiente' | 'ninguno';

const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

export function partes(fecha: PlainDate): { anio: number; mes: number; dia: number } {
  const m = PATRON.exec(fecha);
  if (!m) throw new ErrorDominio('fecha_invalida', `fecha inválida: ${fecha}`);
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    throw new ErrorDominio('fecha_invalida', `fecha inválida: ${fecha}`);
  }
  return { anio, mes, dia };
}

export function esFecha(valor: unknown): valor is PlainDate {
  if (typeof valor !== 'string') return false;
  try {
    partes(valor);
    return true;
  } catch {
    return false;
  }
}

function formatear(anio: number, mes: number, dia: number): PlainDate {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Fecha con `dia` acotado al último día del mes (E1.2). `mes` admite desbordes (13 → enero siguiente). */
export function conDia(anio: number, mes: number, dia: number): PlainDate {
  const indice = anio * 12 + (mes - 1);
  const a = Math.floor(indice / 12);
  const m = indice - a * 12 + 1;
  return formatear(a, m, Math.min(Math.max(dia, 1), diasDelMes(a, m)));
}

/** Días desde 1970-01-01 (algoritmo de días civiles de H. Hinnant). */
export function aDias(fecha: PlainDate): number {
  const { anio, mes, dia } = partes(fecha);
  const y = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (mes + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + dia - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function desdeDias(dias: number): PlainDate {
  const z = dias + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const dia = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp < 10 ? mp + 3 : mp - 9;
  return formatear(yoe + era * 400 + (mes <= 2 ? 1 : 0), mes, dia);
}

export function sumarDias(fecha: PlainDate, n: number): PlainDate {
  return desdeDias(aDias(fecha) + n);
}

/** `b − a` en días. */
export function diferenciaDias(a: PlainDate, b: PlainDate): number {
  return aDias(b) - aDias(a);
}

/** Suma meses conservando el día cuando existe; si no, el último del mes. */
export function sumarMeses(fecha: PlainDate, n: number): PlainDate {
  const { anio, mes, dia } = partes(fecha);
  return conDia(anio, mes + n, dia);
}

export function diaSemana(fecha: PlainDate): DiaSemana {
  // 1970-01-01 fue jueves (4).
  return (((((aDias(fecha) + 3) % 7) + 7) % 7) + 1) as DiaSemana;
}

/** E1.2: `anterior` (sáb −1, dom −2), `siguiente` (sáb +2, dom +1), `ninguno`. */
export function ajustarFinDeSemana(fecha: PlainDate, modo: ModoFinDeSemana): PlainDate {
  const d = diaSemana(fecha);
  if (modo === 'ninguno' || d < 6) return fecha;
  if (modo === 'anterior') return sumarDias(fecha, d === 6 ? -1 : -2);
  return sumarDias(fecha, d === 6 ? 2 : 1);
}

export function compararFechas(a: PlainDate, b: PlainDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minFecha(a: PlainDate, b: PlainDate): PlainDate {
  return a <= b ? a : b;
}

export function maxFecha(a: PlainDate, b: PlainDate): PlainDate {
  return a >= b ? a : b;
}
