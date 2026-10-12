import { ErrorDominio } from '@cartera/core';
import { formatearCentavos } from '../../ui';
import type { EntradaMovimiento, ResumenMovimiento } from '../../servicios';

/**
 * Redacción de las pantallas principales (02-UX §14): solo presentación de datos que ya calculó `servicios/`.
 */

export type TipoMovimiento = EntradaMovimiento['tipo'];

/** Nombres llanos de los movimientos que origina el usuario (sin términos contables). */
export const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Pasar entre mis cuentas',
  retiro_efectivo: 'Sacar efectivo',
  pago_tarjeta: 'Pagar tarjeta',
  prestamo_otorgado: 'Le presté a alguien',
  prestamo_recibido: 'Me prestaron',
  cobro_prestamo: 'Me pagaron lo que me debían',
  pago_prestamo: 'Pagué lo que debía',
};

/** Tipos de movimiento del libro que aparecen en Movimientos (incluye los que no origina el usuario). */
export const NOMBRE_TIPO_LIBRO: Record<string, string> = {
  ...NOMBRE_TIPO,
  ajuste_arqueo: 'Ajuste de efectivo',
  aportacion_tanda: 'Tanda',
  cobro_tanda: 'Cobro de tanda',
  cuenta_dividida: 'Cuenta dividida',
  reembolso: 'Reembolso',
};

export const NOMBRE_ORIGEN: Record<string, string> = {
  voz: 'Registrado por voz',
  texto: 'Registrado escribiendo',
  manual: 'Registrado a mano',
  notificacion: 'Capturado de una notificación',
  correo: 'Capturado de un correo',
  estado_cuenta: 'Leído de tu estado de cuenta',
  ticket: 'Leído de un ticket',
  arqueo: 'Registrado al contar tu efectivo',
  sistema: 'Registrado por la app',
};

export const MENSAJE_NO_ENTENDI = 'No te entendí. Prueba así: «tacos 80 en efectivo».';
export const MENSAJE_POR_INTERPRETAR =
  'Lo guardé; lo interpreto cuando tengas internet. Lo encuentras en Movimientos, en Por revisar.';
export const MENSAJE_ERROR_GENERAL = 'No pude guardarlo. Intenta de nuevo.';

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Coca $25 · Antojos · Efectivo" (02-UX §5). */
export function resumenMovimiento(m: ResumenMovimiento): string {
  const partes = [
    `${capitalizar(m.descripcion ?? NOMBRE_TIPO[m.tipo].toLowerCase())} ${formatearCentavos(m.monto)}`,
  ];
  if (m.categoria) partes.push(m.categoria);
  partes.push(m.porAsignar ? 'por asignar' : m.cuenta);
  return partes.join(' · ');
}

/** "Registré: Coca $25 · Antojos · Efectivo". */
export function mensajeRegistrado(movimientos: readonly ResumenMovimiento[]): string {
  return `Registré: ${movimientos.map(resumenMovimiento).join('; ')}`;
}

/** Código de un error de dominio, o `null` si es otro error. */
export function codigoError(e: unknown): string | null {
  return e instanceof ErrorDominio ? e.codigo : null;
}

/** "dom 11" + "11 oct" → "Dom 11 oct". */
export function encabezadoFecha(diaSemana: string, diaMes: string): string {
  const mes = diaMes.split(' ')[1] ?? '';
  return capitalizar(`${diaSemana} ${mes}`.trim());
}
