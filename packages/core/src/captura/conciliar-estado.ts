/**
 * Completar y conciliar una tarjeta con su estado de cuenta (`docs/07-CAPTURA.md §8`, `02 §26`, M15): cada
 * renglón del estado es una captura de la fuente `estado_cuenta` y pasa por E9.3 contra los movimientos que ya
 * tiene la tarjeta (`05 §E9.3`). Puro: el llamador lee el libro y escribe lo que se decida.
 */
import type { Centavos } from '../dinero';
import {
  CUENTA_POR_ASIGNAR,
  CUENTA_POR_ASIGNAR_ENTRADAS,
  elegirMovimiento,
  type MovimientoDedup,
  type Sentido,
} from '../deduplicacion';
import { sumarDias, type PlainDate } from '../fecha';
import type { MovimientoEstado } from './estados-cuenta';

/** Un movimiento que ya está en el libro, visto desde la tarjeta (o desde una cuenta puente, `05 §E9.3`). */
export interface MovimientoExistente extends MovimientoDedup {
  /** Id de la transacción vigente. */
  readonly id: string;
  /** `salida` si sube la deuda de la tarjeta (o sale de `por_asignar`); `entrada` si la baja. */
  readonly sentido: Sentido;
}

export type DecisionRenglon =
  /** Ya se revisó al leer antes este mismo estado de cuenta (misma tarjeta, corte y renglón). */
  | { readonly indice: number; readonly decision: 'revisado' }
  /** Es de antes del alta de la tarjeta: ya está dentro del saldo con que se dio de alta. */
  | { readonly indice: number; readonly decision: 'anterior' }
  /** E9.3 `fusionar`: ya lo tenías. `puente` = estaba en una cuenta puente y pasa a la tarjeta. */
  | {
      readonly indice: number;
      readonly decision: 'existente';
      readonly transaccion: string;
      readonly puente: boolean;
    }
  /** E9.3 `preguntar`: "¿Es el mismo?". */
  | {
      readonly indice: number;
      readonly decision: 'dudoso';
      readonly transaccion: string;
      readonly puente: boolean;
    }
  /** E9.3 `nuevo`: no lo tenías; se propone agregarlo. */
  | { readonly indice: number; readonly decision: 'nuevo' };

export interface EntradaCompletar {
  /** Id de la cuenta de la tarjeta (la de las capturas de este estado). */
  readonly tarjeta: string;
  readonly movimientos: readonly MovimientoEstado[];
  /** Movimientos vigentes candidatos, en orden de registro, sin los que ya absorbió otro renglón de un estado. */
  readonly existentes: readonly MovimientoExistente[];
  /** Índices de renglones ya revisados de este mismo estado. */
  readonly revisados?: ReadonlySet<number> | undefined;
  /** Alta de la tarjeta: lo anterior ya está en su saldo inicial. `null` = sin alta conocida. */
  readonly alta?: PlainDate | null | undefined;
}

/** Sentido de E9.3 de un renglón: los cargos son salidas de la tarjeta; pagos y abonos, entradas. */
export function sentidoDeRenglon(m: Pick<MovimientoEstado, 'tipo'>): Sentido {
  return m.tipo === 'pago' || m.tipo === 'abono' ? 'entrada' : 'salida';
}

/**
 * E9.3 renglón por renglón, en el orden del estado: cada movimiento existente absorbe a lo más un renglón (uno a
 * uno por fuente); con varias candidatas gana la de menor Δ, luego la de mayor similitud, luego la registrada
 * primero. Una candidata de "preguntar" también queda apartada para ese renglón.
 */
export function completarConEstado(e: EntradaCompletar): DecisionRenglon[] {
  const usados = new Set<string>();
  return e.movimientos.map((m): DecisionRenglon => {
    if (e.revisados?.has(m.indice)) return { indice: m.indice, decision: 'revisado' };
    if (e.alta && m.fecha < e.alta) return { indice: m.indice, decision: 'anterior' };
    const sentido = sentidoDeRenglon(m);
    const candidatos = e.existentes.filter((x) => x.sentido === sentido && !usados.has(x.id));
    const elegido = elegirMovimiento(
      { cuenta: e.tarjeta, monto: m.monto, fecha: m.fecha, comercio: m.descripcion, sentido },
      candidatos,
    );
    if (!elegido) return { indice: m.indice, decision: 'nuevo' };
    const mov = candidatos[elegido.indice] as MovimientoExistente;
    usados.add(mov.id);
    const puente = mov.cuenta === CUENTA_POR_ASIGNAR || mov.cuenta === CUENTA_POR_ASIGNAR_ENTRADAS;
    return {
      indice: m.indice,
      decision: elegido.resultado.decision === 'fusionar' ? 'existente' : 'dudoso',
      transaccion: mov.id,
      puente,
    };
  });
}

/** Días antes del corte en que un movimiento del libro puede no haber llegado todavía al banco (Δ de E9.3). */
export const DIAS_EN_CAMINO = 2;

export interface EntradaSaldoComparable {
  readonly corte: PlainDate;
  /** Deuda de la tarjeta en el libro al corte (`−Libro.saldo(tarjeta, corte)`). */
  readonly deudaLibroAlCorte: Centavos;
  /** Movimientos del libro que corresponden a renglones del estado, con su efecto en la deuda de la tarjeta. */
  readonly vinculados: readonly { readonly fecha: PlainDate; readonly deuda: Centavos }[];
  /**
   * Movimientos del libro en la tarjeta (sin saldos iniciales, conciliaciones ni cuotas MSI) fechados en los
   * `DIAS_EN_CAMINO` días hasta el corte que no corresponden a ningún renglón, con su efecto en la deuda.
   */
  readonly sinRenglonCercaDelCorte: readonly { readonly fecha: PlainDate; readonly deuda: Centavos }[];
}

/**
 * Lo que diría Cartera al corte, comparable con el saldo al corte del banco: la deuda del libro a esa fecha, más
 * lo que el banco ya cargó al corte pero el libro fechó después (un renglón emparejado con Δ ≤ 2), menos lo que el
 * libro fechó al final del periodo y el banco todavía no factura (no está en el estado). Así una diferencia de
 * fechas nunca se vuelve un ajuste que después contaría dos veces.
 */
export function deudaComparableAlCorte(e: EntradaSaldoComparable): Centavos {
  const desde = sumarDias(e.corte, -DIAS_EN_CAMINO);
  let deuda = e.deudaLibroAlCorte;
  for (const v of e.vinculados) if (v.fecha > e.corte) deuda += v.deuda;
  for (const s of e.sinRenglonCercaDelCorte) if (s.fecha > desde && s.fecha <= e.corte) deuda -= s.deuda;
  return deuda;
}
