import { exigirCentavos, type Centavos } from './dinero';
import { ErrorDominio } from './errores';
import type { PlainDate } from './fecha';

/**
 * Generador de fechas de E3.2 (`proximasFechas(regla, desde, n)`): primeras `n` fechas efectivas `≥ desde`.
 * Se inyecta para que E11 no dependa de la forma de `Regla`.
 */
export type GeneradorFechas<R> = (regla: R, desde: PlainDate, n: number) => readonly PlainDate[];

export interface Tanda<R> {
  readonly aportacion: Centavos;
  readonly participantes: number;
  /** 1 = cobras primero. */
  readonly turno: number;
  readonly regla: R;
  readonly inicio: PlainDate;
}

export interface PosicionTanda {
  readonly aportado: Centavos;
  readonly recibido: Centavos;
  /** `aportado − recibido`: positivo = te deben; negativo = debes. */
  readonly posicion: Centavos;
  /** Lo que perderías si la tanda se cae. */
  readonly enRiesgo: Centavos;
  readonly porAportar: Centavos;
}

export interface RondaTanda extends PosicionTanda {
  readonly t: number;
  readonly fecha: PlainDate;
}

export interface CalendarioTanda {
  /** Fecha de la aportación `t` en `rondas[t − 1]`. */
  readonly rondas: readonly PlainDate[];
  readonly fechaCobro: PlainDate;
  readonly posiciones: readonly RondaTanda[];
}

export interface TandaExistente {
  readonly aportacionesHechas: number;
  readonly yaCobro: boolean;
  /** Saldo inicial de `contraparte:tanda:<id>` contra `capital:saldos_iniciales`. */
  readonly saldoInicial: Centavos;
  /** Se crean como `omitida`: ni se apartan ni se vuelven a cobrar. */
  readonly ocurrenciasOmitidas: readonly PlainDate[];
  readonly ocurrenciasPendientes: readonly PlainDate[];
  readonly fechaCobro: PlainDate;
}

function validar(aportacion: Centavos, participantes: number, turno: number): void {
  exigirCentavos(aportacion, 'aportacion', { minimo: 1 });
  if (!Number.isSafeInteger(participantes) || participantes < 1) {
    throw new ErrorDominio('tanda_invalida', 'participantes debe ser un entero ≥ 1');
  }
  if (!Number.isSafeInteger(turno) || turno < 1 || turno > participantes) {
    throw new ErrorDominio('tanda_invalida', 'turno debe estar entre 1 y participantes');
  }
}

/** E11 · Posición después de la aportación `t` (0 = antes de aportar). */
export function posicionTanda(
  aportacion: Centavos,
  participantes: number,
  turno: number,
  t: number,
): PosicionTanda {
  validar(aportacion, participantes, turno);
  if (!Number.isSafeInteger(t) || t < 0 || t > participantes) {
    throw new ErrorDominio('tanda_invalida', 't debe estar entre 0 y participantes');
  }
  const aportado = aportacion * t;
  const recibido = t >= turno ? aportacion * participantes : 0;
  const posicion = aportado - recibido;
  return {
    aportado,
    recibido,
    posicion,
    enRiesgo: Math.max(0, posicion),
    porAportar: aportacion * (participantes - t),
  };
}

function rondasDe<R>(tanda: Tanda<R>, proximasFechas: GeneradorFechas<R>): PlainDate[] {
  validar(tanda.aportacion, tanda.participantes, tanda.turno);
  const rondas = [...proximasFechas(tanda.regla, tanda.inicio, tanda.participantes)];
  if (rondas.length !== tanda.participantes) {
    throw new ErrorDominio('tanda_invalida', 'la regla no da una fecha para cada ronda');
  }
  return rondas;
}

/** E11 · Calendario y posición después de cada aportación. */
export function calendarioTanda<R>(tanda: Tanda<R>, proximasFechas: GeneradorFechas<R>): CalendarioTanda {
  const rondas = rondasDe(tanda, proximasFechas);
  const posiciones = rondas.map((fecha, i) => ({
    t: i + 1,
    fecha,
    ...posicionTanda(tanda.aportacion, tanda.participantes, tanda.turno, i + 1),
  }));
  return { rondas, fechaCobro: rondas[tanda.turno - 1] as PlainDate, posiciones };
}

/**
 * E11 · Tanda que ya existía: las rondas con fecha `< hoy` se toman como aportadas; su posición es el
 * saldo inicial y esas ocurrencias quedan omitidas.
 */
export function tandaExistente<R>(
  tanda: Tanda<R>,
  hoy: PlainDate,
  proximasFechas: GeneradorFechas<R>,
): TandaExistente {
  const rondas = rondasDe(tanda, proximasFechas);
  const ocurrenciasOmitidas = rondas.filter((f) => f < hoy);
  const ocurrenciasPendientes = rondas.filter((f) => f >= hoy);
  const hechas = ocurrenciasOmitidas.length;
  const { posicion } = posicionTanda(tanda.aportacion, tanda.participantes, tanda.turno, hechas);
  return {
    aportacionesHechas: hechas,
    yaCobro: hechas >= tanda.turno,
    saldoInicial: posicion,
    ocurrenciasOmitidas,
    ocurrenciasPendientes,
    fechaCobro: rondas[tanda.turno - 1] as PlainDate,
  };
}
