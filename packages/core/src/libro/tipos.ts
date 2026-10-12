import type { Centavos } from '../dinero';
import type { PlainDate } from '../fecha';

/** Naturalezas del plan de cuentas (`docs/04-DATOS.md §2`). */
export const NATURALEZAS = ['activo', 'pasivo', 'contraparte', 'ingreso', 'gasto', 'capital'] as const;
export type Naturaleza = (typeof NATURALEZAS)[number];

export const ESPACIOS = ['personal', 'negocio'] as const;
export type Espacio = (typeof ESPACIOS)[number];

/** Tipos de transacción (`04 §3`, `CHECK` de `transaccion.tipo`). */
export const TIPOS_TRANSACCION = [
  'gasto',
  'ingreso',
  'transferencia',
  'transferencia_pendiente',
  'retiro_efectivo',
  'pago_tarjeta',
  'prestamo_otorgado',
  'cobro_prestamo',
  'prestamo_recibido',
  'pago_prestamo',
  'compra_msi',
  'reclasificacion_msi',
  'liquidacion_msi',
  'cuenta_dividida',
  'aportacion_tanda',
  'cobro_tanda',
  'ajuste_arqueo',
  'reembolso',
  'saldo_inicial',
  'conciliacion',
  'reversa',
  'venta_credito',
  'cobro_cliente',
  'retiro_dueno',
  'aportacion_dueno',
  'pago_impuestos',
] as const;
export type TipoTransaccion = (typeof TIPOS_TRANSACCION)[number];

export const ORIGENES = [
  'voz',
  'texto',
  'manual',
  'notificacion',
  'correo',
  'estado_cuenta',
  'ticket',
  'arqueo',
  'sistema',
] as const;
export type Origen = (typeof ORIGENES)[number];

export function esTipoTransaccion(valor: unknown): valor is TipoTransaccion {
  return typeof valor === 'string' && (TIPOS_TRANSACCION as readonly string[]).includes(valor);
}

export function esOrigen(valor: unknown): valor is Origen {
  return typeof valor === 'string' && (ORIGENES as readonly string[]).includes(valor);
}

/** Un asiento: débito positivo, crédito negativo (E2 regla 4). */
export interface AsientoPropuesto {
  readonly cuentaId: string;
  readonly monto: Centavos;
}

/** Lo que produce un constructor de asientos: el `tipo` y sus asientos, aún sin fecha ni clave. */
export interface MovimientoPropuesto {
  readonly tipo: TipoTransaccion;
  readonly asientos: readonly AsientoPropuesto[];
  /** Solo `ajuste_arqueo` (y los casos de negocio estimados) lo marcan. */
  readonly estimada?: boolean;
  /** Clave sugerida cuando el caso la define (`msi:{plan}:{k}`). */
  readonly claveIdempotencia?: string;
}

/** Lo que `validarTransaccion` necesita de cada cuenta. */
export interface CuentaParaPatron {
  readonly id: string;
  readonly naturaleza: Naturaleza;
  readonly subtipo: string;
  readonly liquida: boolean;
  readonly espacio: Espacio;
  readonly archivada: boolean;
  /** Subcuenta MSI → su tarjeta. */
  readonly padreId: string | null;
  readonly categoriaSlug: string | null;
}

export interface TransaccionPorValidar {
  readonly tipo: string;
  readonly fecha: PlainDate;
  readonly asientos: readonly AsientoPropuesto[];
  readonly estimada?: boolean;
}
