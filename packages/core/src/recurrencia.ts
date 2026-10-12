import { ErrorDominio } from './errores';
import {
  ajustarFinDeSemana,
  aDias,
  conDia,
  diaSemana,
  partes,
  sumarDias,
  type DiaSemana,
  type ModoFinDeSemana,
  type PlainDate,
} from './fecha';

/** E3.1: si se omite, `'ninguno'`. */
export type Ajuste = ModoFinDeSemana;

/** E3.1 · Reglas de recurrencia de ingresos y egresos programados. */
export type Regla =
  | { tipo: 'quincenal_15_ultimo'; ajuste?: Ajuste }
  | { tipo: 'quincenal_dias'; dias: readonly [number, number]; ajuste?: Ajuste }
  | { tipo: 'mensual'; dia: number; ajuste?: Ajuste }
  | { tipo: 'semanal'; dia_semana: DiaSemana; ajuste?: Ajuste }
  | { tipo: 'catorcenal'; ancla: PlainDate; ajuste?: Ajuste }
  | { tipo: 'anual'; mes: number; dia: number; ajuste?: Ajuste }
  | { tipo: 'unica'; fecha: PlainDate };

function invalida(mensaje: string): never {
  throw new ErrorDominio('regla_invalida', mensaje);
}

function exigirDia(dia: number): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) invalida('día del mes fuera de 1–31');
}

function validarRegla(regla: Regla): void {
  switch (regla.tipo) {
    case 'quincenal_15_ultimo':
      return;
    case 'quincenal_dias':
      regla.dias.forEach(exigirDia);
      return;
    case 'mensual':
      exigirDia(regla.dia);
      return;
    case 'semanal':
      if (!Number.isInteger(regla.dia_semana) || regla.dia_semana < 1 || regla.dia_semana > 7) {
        invalida('dia_semana fuera de 1–7');
      }
      return;
    case 'catorcenal':
      partes(regla.ancla);
      return;
    case 'anual':
      if (!Number.isInteger(regla.mes) || regla.mes < 1 || regla.mes > 12) invalida('mes fuera de 1–12');
      exigirDia(regla.dia);
      return;
    case 'unica':
      partes(regla.fecha);
      return;
    default:
      invalida(`tipo de regla desconocido: ${(regla as { tipo: unknown }).tipo as string}`);
  }
}

function ajusteDe(regla: Regla): Ajuste {
  return regla.tipo === 'unica' ? 'ninguno' : (regla.ajuste ?? 'ninguno');
}

/** Fechas nominales (sin ajuste) en `[desde, hasta]` (ambos inclusive), ordenadas y sin duplicados. */
export function fechasNominales(regla: Regla, desde: PlainDate, hasta: PlainDate): PlainDate[] {
  validarRegla(regla);
  const salida = new Set<PlainDate>();
  const agregar = (f: PlainDate) => {
    if (f >= desde && f <= hasta) salida.add(f);
  };
  const ini = partes(desde);
  const fin = partes(hasta);

  switch (regla.tipo) {
    case 'quincenal_15_ultimo':
    case 'quincenal_dias':
    case 'mensual': {
      const dias =
        regla.tipo === 'quincenal_15_ultimo'
          ? [15, 31]
          : regla.tipo === 'quincenal_dias'
            ? [...regla.dias]
            : [regla.dia];
      const ultimo = fin.anio * 12 + fin.mes;
      for (let i = ini.anio * 12 + ini.mes; i <= ultimo; i++) {
        const anio = Math.floor((i - 1) / 12);
        const mes = i - anio * 12;
        for (const d of dias) agregar(conDia(anio, mes, d));
      }
      break;
    }
    case 'semanal': {
      const corrimiento = (regla.dia_semana - diaSemana(desde) + 7) % 7;
      for (let f = sumarDias(desde, corrimiento); f <= hasta; f = sumarDias(f, 7)) agregar(f);
      break;
    }
    case 'catorcenal': {
      const delta = aDias(desde) - aDias(regla.ancla);
      const k = Math.ceil(delta / 14);
      for (let f = sumarDias(regla.ancla, 14 * k); f <= hasta; f = sumarDias(f, 14)) agregar(f);
      break;
    }
    case 'anual':
      for (let a = ini.anio; a <= fin.anio; a++) agregar(conDia(a, regla.mes, regla.dia));
      break;
    case 'unica':
      agregar(regla.fecha);
      break;
  }
  return [...salida].sort();
}

/** Fechas efectivas (ajustadas por fin de semana) de las nominales en `[desde, hasta]`, ordenadas y únicas. */
export function fechasEfectivas(regla: Regla, desde: PlainDate, hasta: PlainDate): PlainDate[] {
  const ajuste = ajusteDe(regla);
  const ajustadas = new Set(fechasNominales(regla, desde, hasta).map((f) => ajustarFinDeSemana(f, ajuste)));
  return [...ajustadas].sort();
}

/**
 * E3.2: primeras `n` fechas efectivas `≥ desde`. Las nominales se generan en
 * `[desde − 7, desde + alcance]` (`370·(n+1)` días para `anual`, `40·(n+2)` para las demás).
 */
export function proximasFechas(regla: Regla, desde: PlainDate, n: number): PlainDate[] {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new ErrorDominio('parametro_invalido', 'n debe ser un entero ≥ 0');
  }
  const alcance = regla.tipo === 'anual' ? 370 * (n + 1) : 40 * (n + 2);
  return fechasEfectivas(regla, sumarDias(desde, -7), sumarDias(desde, alcance))
    .filter((f) => f >= desde)
    .slice(0, n);
}
