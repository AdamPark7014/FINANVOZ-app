import { exigirCentavos, type Centavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { diaSemana, diferenciaDias, maxFecha, partes, sumarDias, type PlainDate } from '../fecha';
import { distribuirMayorResiduo } from '../reparto';

/** Clase de un día para el bootstrap estratificado (E8.2). */
export type ClaseDia = 'habil' | 'finde' | 'pago';

export interface DiaHistorial {
  readonly fecha: PlainDate;
  readonly clase: ClaseDia;
  /** `max(0, Σ)` del día, en centavos. */
  readonly consumo: Centavos;
}

/**
 * Transacción **vigente** (vista `transaccion_vigente`, `04 §3`) tal como la ve el constructor de historial.
 * `monto_gasto` = Σ de sus asientos en cuentas de gasto (la parte propia en `cuenta_dividida`, negativo en
 * `reembolso`).
 */
export interface TransaccionHistorial {
  readonly fecha: PlainDate;
  readonly tipo: string;
  readonly monto_gasto: Centavos;
  /** Cubrió una ocurrencia programada (ya se modela como compromiso). */
  readonly cubre_ocurrencia?: boolean;
  /** Marcada por el usuario como extraordinaria (`04 §3`). */
  readonly extraordinaria?: boolean;
  /** Solo `ajuste_arqueo`: fecha del arqueo anterior de esa cuenta, si lo hubo. */
  readonly arqueo_anterior?: PlainDate | null;
}

/** Ventana del historial (E8.2). */
export const VENTANA_HISTORIAL = 90;
/** Una clase con menos días usa el pool `todos`. */
export const MIN_DIAS_POOL = 5;
/** Con menos días: `datos_insuficientes` ("Necesito 2 semanas…"). */
export const MIN_DIAS_HISTORIAL = 14;
/** Desde 14 y hasta 41 días la UI muestra "estimación inicial" (`02 §4.2`). */
export const DIAS_ESTIMACION_INICIAL = 42;
/** Días que cubre el primer arqueo (sin uno anterior). */
const DIAS_PRIMER_ARQUEO = 7;

const TIPOS_CONSUMO: ReadonlySet<string> = new Set([
  'gasto',
  'cuenta_dividida',
  'ajuste_arqueo',
  'reembolso',
]);

export type EstadoDatos = 'datos_insuficientes' | 'estimacion_inicial' | 'normal';

/** Estado de datos de Hoy según los días de historial (`02 §4.2`). */
export function estadoDatos(diasHistorial: number): EstadoDatos {
  if (diasHistorial < MIN_DIAS_HISTORIAL) return 'datos_insuficientes';
  return diasHistorial < DIAS_ESTIMACION_INICIAL ? 'estimacion_inicial' : 'normal';
}

/** `pago` si la fecha es una ocurrencia de ingreso recibida; si no `finde` (sáb, dom) o `habil`. */
export function claseDia(fecha: PlainDate, fechasIngreso: ReadonlySet<PlainDate>): ClaseDia {
  if (fechasIngreso.has(fecha)) return 'pago';
  return diaSemana(fecha) >= 6 ? 'finde' : 'habil';
}

/**
 * E8.2 · Un registro por día completo en `[max(inicio_uso, hoy − 90), hoy)`. Cuentan `gasto`,
 * `cuenta_dividida`, `ajuste_arqueo` (repartido) y `reembolso`; se excluyen los demás tipos, los movimientos que
 * cubrieron una ocurrencia y los extraordinarios. Días sin movimientos valen 0 y sí cuentan.
 */
export function construirHistorial(
  transacciones: readonly TransaccionHistorial[],
  inicioUso: PlainDate,
  hoy: PlainDate,
  fechasIngreso: readonly PlainDate[],
  ventana: number = VENTANA_HISTORIAL,
): DiaHistorial[] {
  partes(inicioUso);
  partes(hoy);
  const desde = maxFecha(inicioUso, sumarDias(hoy, -ventana));
  const n = Math.max(0, diferenciaDias(desde, hoy));
  const acumulado = new Array<number>(n).fill(0);
  const sumar = (fecha: PlainDate, monto: number) => {
    const i = diferenciaDias(desde, fecha);
    if (i >= 0 && i < n) acumulado[i] = (acumulado[i] as number) + monto;
  };

  for (const t of transacciones) {
    partes(t.fecha);
    exigirCentavos(t.monto_gasto, 'monto_gasto', { minimo: Number.MIN_SAFE_INTEGER });
    if (!TIPOS_CONSUMO.has(t.tipo) || t.cubre_ocurrencia || t.extraordinaria) continue;
    if (t.tipo !== 'ajuste_arqueo') {
      sumar(t.fecha, t.monto_gasto);
      continue;
    }
    // Arqueo: entre los días (arqueo anterior, fecha]; si es el primero, los 7 que terminan en su fecha.
    const inicioTramo = t.arqueo_anterior
      ? sumarDias(t.arqueo_anterior, 1)
      : maxFecha(inicioUso, sumarDias(t.fecha, -(DIAS_PRIMER_ARQUEO - 1)));
    const largo = diferenciaDias(inicioTramo, t.fecha) + 1;
    if (largo < 1) {
      sumar(t.fecha, t.monto_gasto);
      continue;
    }
    distribuirMayorResiduo(t.monto_gasto, new Array<number>(largo).fill(1)).forEach((parte, k) =>
      sumar(sumarDias(inicioTramo, k), parte),
    );
  }

  const pagos = new Set(fechasIngreso);
  return acumulado.map((suma, i) => {
    const fecha = sumarDias(desde, i);
    return { fecha, clase: claseDia(fecha, pagos), consumo: Math.max(0, suma) };
  });
}

export type Pools = Readonly<Record<ClaseDia, readonly Centavos[]>>;

/** Pools por clase; una clase con < 5 días usa el de todos los días. */
export function construirPools(historial: readonly DiaHistorial[]): Pools {
  const todos = historial.map((d) => d.consumo);
  const de = (clase: ClaseDia) => {
    const p = historial.filter((d) => d.clase === clase).map((d) => d.consumo);
    return p.length >= MIN_DIAS_POOL ? p : todos;
  };
  return { habil: de('habil'), finde: de('finde'), pago: de('pago') };
}

/** Valida un historial ya construido (consumos enteros ≥ 0 y fechas válidas). */
export function validarHistorial(historial: readonly DiaHistorial[]): void {
  for (const d of historial) {
    partes(d.fecha);
    exigirCentavos(d.consumo, 'consumo');
    if (d.clase !== 'habil' && d.clase !== 'finde' && d.clase !== 'pago') {
      throw new ErrorDominio('historial_invalido', 'clase de día desconocida');
    }
  }
}
