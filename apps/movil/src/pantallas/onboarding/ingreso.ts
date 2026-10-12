import { sumarDias, type DiaSemana, type ModoFinDeSemana, type PlainDate, type Regla } from '@cartera/core';

/**
 * Traduce las respuestas de O3 (chips) a la regla de recurrencia que entiende `servicios/`. Es solo el mapeo de
 * la pantalla: las fechas las calcula `proximoPago` en servicios.
 */

export type Frecuencia = 'quincena' | 'semanal' | 'catorcenal' | 'mensual' | 'varia';
export type FinDeSemana = 'antes' | 'despues' | 'mismo';

export const OPCIONES_FRECUENCIA: readonly { valor: Frecuencia; etiqueta: string }[] = [
  { valor: 'quincena', etiqueta: 'Quincena (15 y último)' },
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'catorcenal', etiqueta: 'Cada 14 días' },
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'varia', etiqueta: 'Varía' },
];

export const OPCIONES_FIN_DE_SEMANA: readonly { valor: FinDeSemana; etiqueta: string }[] = [
  { valor: 'antes', etiqueta: 'Antes' },
  { valor: 'despues', etiqueta: 'Después' },
  { valor: 'mismo', etiqueta: 'El mismo día' },
];

export const OPCIONES_DIA_SEMANA: readonly { valor: DiaSemana; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
  { valor: 7, etiqueta: 'Domingo' },
];

const AJUSTE: Record<FinDeSemana, ModoFinDeSemana> = {
  antes: 'anterior',
  despues: 'siguiente',
  mismo: 'ninguno',
};

/** Fechas que se ofrecen para "¿Cuándo te pagan la próxima vez?" (cada 14 días): hoy y los 13 siguientes. */
export function proximos14Dias(hoy: PlainDate): PlainDate[] {
  return Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i));
}

/** Lee un entero escrito a mano dentro de `[min, max]` (día del mes, meses que faltan) o `null`. */
export function leerEntero(texto: string, min: number, max: number): number | null {
  const t = texto.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

/** Día del mes (1–31) o `null`. */
export function leerDiaMes(texto: string): number | null {
  return leerEntero(texto, 1, 31);
}

export interface RespuestasIngreso {
  frecuencia: Frecuencia;
  finDeSemana: FinDeSemana;
  diaSemana: DiaSemana | null;
  /** Próxima fecha de pago (cada 14 días). */
  ancla: PlainDate | null;
  diaMes: number | null;
}

/** `null` si falta un dato o la frecuencia es "Varía". */
export function reglaDeIngreso(r: RespuestasIngreso): Regla | null {
  const ajuste = AJUSTE[r.finDeSemana];
  switch (r.frecuencia) {
    case 'quincena':
      return { tipo: 'quincenal_15_ultimo', ajuste };
    case 'semanal':
      return r.diaSemana === null ? null : { tipo: 'semanal', dia_semana: r.diaSemana, ajuste };
    case 'catorcenal':
      return r.ancla === null ? null : { tipo: 'catorcenal', ancla: r.ancla, ajuste };
    case 'mensual':
      return r.diaMes === null ? null : { tipo: 'mensual', dia: r.diaMes, ajuste };
    case 'varia':
      return null;
  }
}

/** Concepto del programado según la frecuencia ("quincena" es el que usan los vectores). */
export function conceptoIngreso(f: Frecuencia): string {
  return f === 'quincena' ? 'quincena' : f === 'semanal' ? 'semana' : 'sueldo';
}
