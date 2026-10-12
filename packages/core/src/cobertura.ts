import { exigirCentavos, type Centavos } from './dinero';
import { diferenciaDias, type PlainDate } from './fecha';

/** Ventana de un ingreso: puede adelantarse hasta 3 días o retrasarse hasta 2 (E3.5). */
export const VENTANA_INGRESO_ANTES = 3;
export const VENTANA_INGRESO_DESPUES = 2;
/** Diferencia máxima de fechas para un egreso (E3.5). */
export const VENTANA_EGRESO = 3;
/** Umbral de similitud de comercio (E9.2) para empatar un egreso. */
export const UMBRAL_SIMILITUD_COMERCIO = 0.85;

export type DecisionCobertura = 'cubrir' | 'preguntar' | 'no';

export type OcurrenciaCobertura =
  | {
      tipo: 'ingreso';
      fecha: PlainDate;
      monto: Centavos;
      cuenta?: string | null;
    }
  | {
      tipo: 'egreso';
      fecha: PlainDate;
      monto: Centavos;
      cuenta?: string | null;
      categoria?: string | null;
      comercio?: string | null;
      /** Recibos de luz, agua, gas: aceptan hasta 25 % de diferencia sin preguntar. */
      variable?: boolean;
    };

/** Movimiento ya elegido por servicios como candidato (E3.5 "qué movimientos cuentan"). */
export interface MovimientoCobertura {
  sentido: 'entrada' | 'salida';
  fecha: PlainDate;
  monto: Centavos;
  cuenta: string;
  categoria?: string | null;
  comercio?: string | null;
}

/**
 * Similitud de comercios de E9.2 sobre cadenas crudas: quien la inyecta normaliza (E9.1).
 * Se inyecta para no acoplar E3 a E9.
 */
export type SimilitudComercio = (a: string, b: string) => number;

/** Sin similitud inyectada ningún comercio empata: nunca se marca cubierto de más (regla 12). */
const sinSimilitud: SimilitudComercio = () => 0;

/** `|a − b| · 100 ≤ pct · b` en aritmética entera. */
function dentroDe(monto: Centavos, referencia: Centavos, pct: number): boolean {
  return BigInt(Math.abs(monto - referencia)) * 100n <= BigInt(pct) * BigInt(referencia);
}

/** E3.5: ¿el movimiento cubre la ocurrencia programada? */
export function cubreOcurrencia(
  ocurrencia: OcurrenciaCobertura,
  movimiento: MovimientoCobertura,
  similitudComercio: SimilitudComercio = sinSimilitud,
): DecisionCobertura {
  exigirCentavos(ocurrencia.monto, 'ocurrencia.monto');
  exigirCentavos(movimiento.monto, 'movimiento.monto');
  const df = diferenciaDias(ocurrencia.fecha, movimiento.fecha);
  if (ocurrencia.cuenta && ocurrencia.cuenta !== movimiento.cuenta) return 'no';

  if (ocurrencia.tipo === 'ingreso') {
    if (movimiento.sentido !== 'entrada') return 'no';
    if (df < -VENTANA_INGRESO_ANTES || df > VENTANA_INGRESO_DESPUES) return 'no';
    return dentroDe(movimiento.monto, ocurrencia.monto, 10) ? 'cubrir' : 'no';
  }

  if (movimiento.sentido !== 'salida' || Math.abs(df) > VENTANA_EGRESO) return 'no';
  const porCategoria = !!ocurrencia.categoria && ocurrencia.categoria === movimiento.categoria;
  const porComercio =
    !!ocurrencia.comercio &&
    !!movimiento.comercio &&
    similitudComercio(ocurrencia.comercio, movimiento.comercio) >= UMBRAL_SIMILITUD_COMERCIO;
  if (!porCategoria && !porComercio) return 'no';
  if (movimiento.monto === ocurrencia.monto) return 'cubrir';
  if (dentroDe(movimiento.monto, ocurrencia.monto, 25)) {
    return ocurrencia.variable ? 'cubrir' : 'preguntar';
  }
  return 'no';
}

/**
 * E3.5: si varias ocurrencias califican, la de menor diferencia relativa de monto y luego la fecha
 * más cercana (empate final: el índice menor). `null` si ninguna califica.
 */
export function elegirOcurrencia(
  ocurrencias: readonly OcurrenciaCobertura[],
  movimiento: MovimientoCobertura,
  similitudComercio: SimilitudComercio = sinSimilitud,
): { indice: number; decision: Exclude<DecisionCobertura, 'no'> } | null {
  let mejor: { indice: number; decision: Exclude<DecisionCobertura, 'no'> } | null = null;
  let mejorOc: OcurrenciaCobertura | undefined;
  for (const [indice, oc] of ocurrencias.entries()) {
    const decision = cubreOcurrencia(oc, movimiento, similitudComercio);
    if (decision === 'no') continue;
    if (mejorOc === undefined || compararCandidatas(oc, mejorOc, movimiento) < 0) {
      mejor = { indice, decision };
      mejorOc = oc;
    }
  }
  return mejor;
}

/** Negativo si `a` es mejor candidata que `b`. */
function compararCandidatas(
  a: OcurrenciaCobertura,
  b: OcurrenciaCobertura,
  mov: MovimientoCobertura,
): number {
  // |m − a|/a vs |m − b|/b sin flotantes: |m − a|·b vs |m − b|·a.
  const ra = BigInt(Math.abs(mov.monto - a.monto)) * BigInt(b.monto);
  const rb = BigInt(Math.abs(mov.monto - b.monto)) * BigInt(a.monto);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return Math.abs(diferenciaDias(a.fecha, mov.fecha)) - Math.abs(diferenciaDias(b.fecha, mov.fecha));
}
