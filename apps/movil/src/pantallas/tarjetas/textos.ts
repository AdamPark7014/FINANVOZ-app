import { etiquetaDiaMes, type CompraMsiRegistrada, type TarjetaEditada } from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Redacción de Tarjetas (`02 §8`, `02 §14`): solo presenta lo que ya calculó `servicios/`. */

/** `'2026-11'` → "nov 2026". */
export function etiquetaMes(mes: string): string {
  const abreviado = etiquetaDiaMes(`${mes}-01`).split(' ')[1] ?? mes;
  return `${abreviado} ${mes.slice(0, 4)}`;
}

/** "12 meses de $1,000" (o "11 de $1,000 y 1 de $1,000.50" si la última cuota absorbe el residuo). */
export function lineaCuotas(c: Pick<CompraMsiRegistrada, 'meses' | 'cuotas'>): string {
  const grupos = new Map<number, number>();
  for (const q of c.cuotas) grupos.set(q.monto, (grupos.get(q.monto) ?? 0) + 1);
  const partes = [...grupos.entries()].map(([monto, n]) => `${n} de ${formatearCentavos(monto)}`);
  if (partes.length === 1) return `${c.meses} meses de ${formatearCentavos(c.cuotas[0]?.monto ?? 0)}`;
  return `${c.meses} meses: ${partes.join(' y ')}`;
}

/** "Registré: Tele $12,000 a 12 meses sin intereses · Banamex Oro ••8812" + "12 meses de $1,000". */
export function mensajeCompraMsi(c: CompraMsiRegistrada): string {
  const que = c.descripcion.charAt(0).toUpperCase() + c.descripcion.slice(1);
  return `Registré: ${que} ${formatearCentavos(c.monto)} a ${c.meses} meses sin intereses · ${c.tarjeta}\n${lineaCuotas(c)}`;
}

function cicloEnPalabras(ciclo: TarjetaEditada['ciclo']): string {
  const pago =
    ciclo.diaLimitePago !== undefined
      ? `pagas el ${ciclo.diaLimitePago}`
      : `tienes ${ciclo.diasParaPagar ?? 0} días para pagar`;
  return `corta el ${ciclo.diaCorte} y ${pago}`;
}

/** "Listo: tu Nu ••4410 corta el 28 y pagas el 18." */
export function mensajeTarjetaConfigurada(tarjeta: string, editada: TarjetaEditada): string {
  return `Listo: tu ${tarjeta} ${cicloEnPalabras(editada.ciclo)}.`;
}

/** "Registré: pago a tu Nu ••4410 $2,000". */
export function mensajePagoTarjeta(tarjeta: string, monto: number): string {
  return `Registré: pago a tu ${tarjeta} ${formatearCentavos(monto)}`;
}

export const NOMBRE_MODO = {
  totalero: 'La pago completa cada mes',
  plan: 'Voy pagando por partes',
} as const;

export const VACIO_MSI_TARJETA = 'No tienes compras a meses en esta tarjeta.';

export const NOMBRE_ESTADO_PLAN = {
  activo: 'Activo',
  terminado: 'Ya pagaste todas las cuotas',
  liquidado: 'Ya lo terminaste de pagar',
} as const;
