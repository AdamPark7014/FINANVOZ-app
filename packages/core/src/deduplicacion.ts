/** E9.3 y E9.4 · Captura ↔ movimiento existente y transferencias entre cuentas propias (`docs/05-MOTORES.md §E9`). */
import { normalizarComercio, similitud as similitudComercios } from './comercios';
import { exigirCentavos, type Centavos } from './dinero';
import { diferenciaDias, type PlainDate } from './fecha';

/** Cuenta puente de las salidas dictadas sin método. */
export const CUENTA_POR_ASIGNAR = 'por_asignar';
/** Cuenta puente de las entradas dictadas sin cuenta. */
export const CUENTA_POR_ASIGNAR_ENTRADAS = 'por_asignar_entradas';

export type Sentido = 'salida' | 'entrada';

export interface CapturaDedup {
  readonly cuenta: string;
  readonly monto: Centavos;
  readonly fecha: PlainDate;
  readonly comercio?: string | null | undefined;
  /** `salida` por omisión. */
  readonly sentido?: Sentido | undefined;
}

export interface MovimientoDedup {
  readonly cuenta: string;
  /** Cuenta raíz: una subcuenta MSI cuenta como su tarjeta. Por omisión, `cuenta`. */
  readonly cuentaRaiz?: string | undefined;
  readonly monto: Centavos;
  readonly fecha: PlainDate;
  readonly comercio?: string | null | undefined;
  /** Tipo de transacción del movimiento (`ingreso`, `gasto`, `compra_msi`…). */
  readonly tipo?: string | undefined;
}

export type Decision = 'fusionar' | 'preguntar' | 'nuevo';

export interface ResultadoDuplicado {
  readonly decision: Decision;
  /** `null` si la cuenta no es compatible. */
  readonly deltaDias: number | null;
  /** Solo cuando se compararon comercios (mismo monto, movimiento con comercio y fuera de cuenta puente). */
  readonly similitud: number | null;
}

/** E9.3 · ¿La captura es el mismo movimiento que uno ya registrado sin captura? */
export function decidirDuplicado(captura: CapturaDedup, movimiento: MovimientoDedup): ResultadoDuplicado {
  const montoCaptura = exigirCentavos(captura.monto, 'captura.monto');
  const montoMovimiento = exigirCentavos(movimiento.monto, 'movimiento.monto');
  const sentido = captura.sentido ?? 'salida';
  const puente = sentido === 'salida' ? CUENTA_POR_ASIGNAR : CUENTA_POR_ASIGNAR_ENTRADAS;
  const cuentaMovimiento = movimiento.cuentaRaiz ?? movimiento.cuenta;
  if (cuentaMovimiento !== captura.cuenta && cuentaMovimiento !== puente) {
    return { decision: 'nuevo', deltaDias: null, similitud: null };
  }
  const delta = Math.abs(diferenciaDias(movimiento.fecha, captura.fecha));

  if (montoCaptura !== montoMovimiento) {
    const dentroDel10 = Math.abs(montoCaptura - montoMovimiento) * 100 <= 10 * montoCaptura;
    const preguntar = sentido === 'entrada' && movimiento.tipo === 'ingreso' && delta <= 2 && dentroDel10;
    return { decision: preguntar ? 'preguntar' : 'nuevo', deltaDias: delta, similitud: null };
  }

  if (cuentaMovimiento === puente || !movimiento.comercio) {
    const decision: Decision = delta <= 1 ? 'fusionar' : delta === 2 ? 'preguntar' : 'nuevo';
    return { decision, deltaDias: delta, similitud: null };
  }

  const s = similitudComercios(normalizarComercio(captura.comercio), normalizarComercio(movimiento.comercio));
  const decision: Decision =
    delta <= 1 && s >= 0.85 ? 'fusionar' : delta <= 2 && s >= 0.7 ? 'preguntar' : 'nuevo';
  return { decision, deltaDias: delta, similitud: s };
}

export interface CandidatoElegido {
  /** Posición en la lista recibida. */
  readonly indice: number;
  readonly resultado: ResultadoDuplicado;
}

/**
 * E9.3 · Con varias candidatas: menor Δ, luego mayor similitud, luego la registrada primero
 * (`candidatos` llega en orden de registro y ya sin los movimientos que absorbieron una captura de esta fuente).
 * Devuelve `null` si todas dan `nuevo`. Una similitud no calculada (`null`) ordena como 0.
 */
export function elegirMovimiento(
  captura: CapturaDedup,
  candidatos: readonly MovimientoDedup[],
): CandidatoElegido | null {
  let mejor: CandidatoElegido | null = null;
  candidatos.forEach((movimiento, indice) => {
    const resultado = decidirDuplicado(captura, movimiento);
    if (resultado.decision === 'nuevo' || resultado.deltaDias === null) return;
    if (mejor === null || esMejor(resultado, mejor.resultado)) mejor = { indice, resultado };
  });
  return mejor;
}

function esMejor(a: ResultadoDuplicado, b: ResultadoDuplicado): boolean {
  const da = a.deltaDias ?? Number.POSITIVE_INFINITY;
  const db = b.deltaDias ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da < db;
  return (a.similitud ?? 0) > (b.similitud ?? 0);
}

// ---------------------------------------------------------------------------
// E9.4 · Transferencias entre cuentas propias
// ---------------------------------------------------------------------------

export type Espacio = 'personal' | 'negocio';

export type TipoCapturaTransferencia =
  'transferencia_enviada' | 'transferencia_recibida' | 'pago_recibido_tarjeta';

export interface CapturaTransferencia {
  readonly id: string;
  readonly cuenta: string;
  /** `personal` por omisión. */
  readonly espacio?: Espacio | undefined;
  readonly monto: Centavos;
  readonly fecha: PlainDate;
  readonly tipo: TipoCapturaTransferencia;
  /** Ya tiene una transacción registrada (que el par reemplaza). */
  readonly yaRegistrada?: boolean | undefined;
}

export type MovimientoTransferencia = 'transferencia' | 'pago_tarjeta' | 'retiro_dueno' | 'aportacion_dueno';

export interface ParTransferencia {
  readonly salida: string;
  readonly entrada: string;
  readonly movimiento: MovimientoTransferencia;
  /** Solo entre espacios: la entrada es el pago de una tarjeta y servicios lo descompone (`04 §4`, caso 29). */
  readonly pagoTarjeta?: boolean;
  /** Ids ya registrados que la transacción del par reemplaza, en orden. */
  readonly reemplazar: readonly string[];
}

function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * E9.4 · Empareja salidas y entradas sin pareja (el llamador pasa las de las últimas 24 h):
 * mismo monto, cuentas distintas, `Δ ≤ 1` día; orden `(Δ, id salida, id entrada)`; voraz uno a uno.
 */
export function emparejarTransferencias(
  salidas: readonly CapturaTransferencia[],
  entradas: readonly CapturaTransferencia[],
): ParTransferencia[] {
  const candidatos: { delta: number; salida: CapturaTransferencia; entrada: CapturaTransferencia }[] = [];
  for (const salida of salidas) {
    exigirCentavos(salida.monto, 'salida.monto');
    for (const entrada of entradas) {
      exigirCentavos(entrada.monto, 'entrada.monto');
      if (salida.cuenta === entrada.cuenta || salida.monto !== entrada.monto) continue;
      const delta = Math.abs(diferenciaDias(salida.fecha, entrada.fecha));
      if (delta <= 1) candidatos.push({ delta, salida, entrada });
    }
  }
  candidatos.sort(
    (x, y) =>
      x.delta - y.delta ||
      compararTexto(x.salida.id, y.salida.id) ||
      compararTexto(x.entrada.id, y.entrada.id),
  );

  const usadasSalida = new Set<string>();
  const usadasEntrada = new Set<string>();
  const pares: ParTransferencia[] = [];
  for (const { salida, entrada } of candidatos) {
    if (usadasSalida.has(salida.id) || usadasEntrada.has(entrada.id)) continue;
    usadasSalida.add(salida.id);
    usadasEntrada.add(entrada.id);
    const espacioSalida = salida.espacio ?? 'personal';
    const espacioEntrada = entrada.espacio ?? 'personal';
    const esPagoTarjeta = entrada.tipo === 'pago_recibido_tarjeta';
    const reemplazar = [salida, entrada]
      .filter((c) => c.yaRegistrada === true)
      .map((c) => c.id)
      .sort(compararTexto);
    if (espacioSalida === espacioEntrada) {
      pares.push({
        salida: salida.id,
        entrada: entrada.id,
        movimiento: esPagoTarjeta ? 'pago_tarjeta' : 'transferencia',
        reemplazar,
      });
    } else {
      pares.push({
        salida: salida.id,
        entrada: entrada.id,
        movimiento: espacioSalida === 'negocio' ? 'retiro_dueno' : 'aportacion_dueno',
        pagoTarjeta: esPagoTarjeta,
        reemplazar,
      });
    }
  }
  return pares;
}
