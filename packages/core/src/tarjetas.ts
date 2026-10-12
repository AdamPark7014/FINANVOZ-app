import { exigirCentavos, type Centavos, type PuntosBase } from './dinero';
import { ErrorDominio } from './errores';
import { conDia, diferenciaDias, partes, sumarDias, type PlainDate } from './fecha';

/**
 * Configuración de ciclo de una tarjeta (`docs/05-MOTORES.md §E5`): `diaCorte` (1–31) y **uno** de
 * `diasParaPagar` o `diaLimitePago`.
 */
export interface TarjetaCredito {
  readonly diaCorte: number;
  readonly diasParaPagar?: number;
  readonly diaLimitePago?: number;
}

export type ModoTarjeta = 'totalero' | 'plan';

export interface Ciclo {
  readonly corte: PlainDate;
  readonly limite: PlainDate;
  /** `limite − compra` en días. */
  readonly dias: number;
}

function esDiaDelMes(valor: unknown): valor is number {
  return Number.isSafeInteger(valor) && (valor as number) >= 1 && (valor as number) <= 31;
}

/** Valida la configuración del ciclo; lanza `tarjeta_invalida`. */
export function validarTarjeta(tarjeta: TarjetaCredito): void {
  if (!esDiaDelMes(tarjeta.diaCorte)) {
    throw new ErrorDominio('tarjeta_invalida', 'diaCorte debe ser un entero de 1 a 31');
  }
  const conDias = tarjeta.diasParaPagar !== undefined;
  const conDiaLimite = tarjeta.diaLimitePago !== undefined;
  if (conDias === conDiaLimite) {
    throw new ErrorDominio('tarjeta_invalida', 'se requiere uno solo de diasParaPagar o diaLimitePago');
  }
  if (conDias && (!Number.isSafeInteger(tarjeta.diasParaPagar) || (tarjeta.diasParaPagar as number) < 1)) {
    throw new ErrorDominio('tarjeta_invalida', 'diasParaPagar debe ser un entero ≥ 1');
  }
  if (conDiaLimite && !esDiaDelMes(tarjeta.diaLimitePago)) {
    throw new ErrorDominio('tarjeta_invalida', 'diaLimitePago debe ser un entero de 1 a 31');
  }
}

/** E5.1 · Corte en el que entra una compra de `fecha` (una compra el día de corte entra en ese corte). */
export function corteDe(tarjeta: TarjetaCredito, fecha: PlainDate): PlainDate {
  validarTarjeta(tarjeta);
  const { anio, mes } = partes(fecha);
  const c = conDia(anio, mes, tarjeta.diaCorte);
  return c >= fecha ? c : conDia(anio, mes + 1, tarjeta.diaCorte);
}

/** El corte del mes siguiente a `corte`. */
export function siguienteCorte(tarjeta: TarjetaCredito, corte: PlainDate): PlainDate {
  validarTarjeta(tarjeta);
  const { anio, mes } = partes(corte);
  return conDia(anio, mes + 1, tarjeta.diaCorte);
}

/** E5.1 · Fecha límite de pago del periodo que cierra en `corte`. */
export function limiteDe(tarjeta: TarjetaCredito, corte: PlainDate): PlainDate {
  validarTarjeta(tarjeta);
  if (tarjeta.diasParaPagar !== undefined) return sumarDias(corte, tarjeta.diasParaPagar);
  const dia = tarjeta.diaLimitePago as number;
  const { anio, mes } = partes(corte);
  const l = conDia(anio, mes, dia);
  return l > corte ? l : conDia(anio, mes + 1, dia);
}

/** E5.1 · Corte, límite y días de financiamiento de una compra. */
export function cicloDe(tarjeta: TarjetaCredito, fechaCompra: PlainDate): Ciclo {
  const corte = corteDe(tarjeta, fechaCompra);
  const limite = limiteDe(tarjeta, corte);
  return { corte, limite, dias: diferenciaDias(fechaCompra, limite) };
}

/** E5.1 · `limiteDe(corteDe(compra)) − compra`. */
export function diasFinanciamiento(tarjeta: TarjetaCredito, fechaCompra: PlainDate): number {
  return cicloDe(tarjeta, fechaCompra).dias;
}

// ---------------------------------------------------------------------------
// E5.2 · Recomendación de tarjeta
// ---------------------------------------------------------------------------

export interface TarjetaRecomendable extends TarjetaCredito {
  readonly id: string;
  readonly modo: ModoTarjeta;
  readonly limiteCredito: Centavos;
  /** Negativo = saldo a favor. */
  readonly saldoRevolvente: Centavos;
  readonly msiNoFacturado: Centavos;
}

export interface CompraPorRecomendar {
  readonly fecha: PlainDate;
  readonly monto: Centavos;
}

export interface CandidataTarjeta extends Ciclo {
  readonly id: string;
  readonly usoBp: PuntosBase;
}

export type AdvertenciaTarjeta = 'uso_alto' | 'sin_credito_disponible';

export interface Recomendacion {
  readonly tarjeta: CandidataTarjeta | null;
  readonly advertencia: AdvertenciaTarjeta | null;
  /** Las tarjetas en modo `totalero` con límite > 0, en el orden de entrada. */
  readonly candidatas: readonly CandidataTarjeta[];
}

/** Umbral de uso del límite recomendado por Condusef (30 %). */
export const UMBRAL_USO_BP: PuntosBase = 3000;

/**
 * E5.2 · Elige la tarjeta `totalero` que más días financia sin pasar del umbral de uso.
 * Una tarjeta sin límite (`limiteCredito = 0`) nunca es elegible (regla 12).
 */
export function recomendarTarjeta(
  compra: CompraPorRecomendar,
  tarjetas: readonly TarjetaRecomendable[],
  umbralUsoBp: PuntosBase = UMBRAL_USO_BP,
): Recomendacion {
  const monto = exigirCentavos(compra.monto, 'monto');
  const candidatas: CandidataTarjeta[] = [];
  for (const t of tarjetas) {
    if (t.modo !== 'totalero') continue;
    const limite = exigirCentavos(t.limiteCredito, 'limiteCredito');
    const saldo = exigirCentavos(t.saldoRevolvente, 'saldoRevolvente', { minimo: Number.MIN_SAFE_INTEGER });
    const msi = exigirCentavos(t.msiNoFacturado, 'msiNoFacturado');
    const deuda = BigInt(Math.max(0, saldo)) + BigInt(msi) + BigInt(monto);
    if (limite === 0) continue;
    const usoBp = Number((deuda * 10000n) / BigInt(limite));
    candidatas.push({ id: t.id, usoBp, ...cicloDe(t, compra.fecha) });
  }

  let elegibles = candidatas.filter((c) => c.usoBp <= umbralUsoBp);
  let advertencia: AdvertenciaTarjeta | null = null;
  if (elegibles.length === 0) {
    elegibles = candidatas.filter((c) => c.usoBp <= 10000);
    advertencia = elegibles.length > 0 ? 'uso_alto' : 'sin_credito_disponible';
  }
  const orden = [...elegibles].sort(
    (a, b) => b.dias - a.dias || a.usoBp - b.usoBp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return { tarjeta: orden[0] ?? null, advertencia, candidatas };
}

// ---------------------------------------------------------------------------
// E5.3 · Cierre de periodo
// ---------------------------------------------------------------------------

/**
 * E5.3 · Cortes `c` con `alta < c ≤ hoy` que no están en `procesados`. Nunca se procesan cortes
 * anteriores o iguales al alta: el saldo del onboarding ya los incluye.
 */
export function cortesAProcesar(
  tarjeta: TarjetaCredito,
  alta: PlainDate,
  hoy: PlainDate,
  procesados: Iterable<PlainDate>,
): PlainDate[] {
  const hechos = new Set(procesados);
  const salida: PlainDate[] = [];
  for (let c = corteDe(tarjeta, sumarDias(alta, 1)); c <= hoy; c = siguienteCorte(tarjeta, c)) {
    if (!hechos.has(c)) salida.push(c);
  }
  return salida;
}

/** Clave de idempotencia del estado de cuenta de un corte. */
export function claveCorte(tarjetaId: string, corte: PlainDate): string {
  return `corte:${tarjetaId}:${corte}`;
}

/** E5.3 · PNGI derivado: `max(0, saldo_corte − pagos y abonos con fecha posterior al corte)`. */
export function pngiDe(saldoCorte: Centavos, pagosPosteriores: Centavos): Centavos {
  exigirCentavos(saldoCorte, 'saldoCorte', { minimo: Number.MIN_SAFE_INTEGER });
  exigirCentavos(pagosPosteriores, 'pagosPosteriores');
  return Math.max(0, saldoCorte - pagosPosteriores);
}
