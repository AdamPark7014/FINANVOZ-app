import { ErrorDominio } from '@cartera/core';
import { formatearCentavos } from '../../ui';
import {
  etiquetaDiaMes,
  type CompromisoConfigurado,
  type EntradaMovimiento,
  type MotivoNoSoportado,
  type MotivoPorInterpretar,
  type ResultadoTexto,
  type ResumenMovimiento,
  type ResumenTransaccion,
} from '../../servicios';

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

/** Por qué quedó guardada la frase (`02 §5`, punto 8). */
export const MENSAJE_GUARDADA: Record<MotivoPorInterpretar, string> = {
  sin_nube: MENSAJE_POR_INTERPRETAR,
  sin_red: MENSAJE_POR_INTERPRETAR,
  limite: 'Ya usaste las frases que interpreto en internet por ahora. La guardé y la interpreto después.',
  error: 'No pude interpretarla en este momento. La guardé y lo intento de nuevo más tarde.',
};

export const MENSAJE_NO_SOPORTADO: Record<MotivoNoSoportado, string> = {
  tipo_movimiento: 'Todavía no registro ese tipo de movimiento hablando. Usa el formulario.',
  intencion: 'Eso todavía no lo hago. Llega pronto.',
  ajuste: 'Eso todavía no lo configuro hablando. Hazlo en Ajustes.',
  consulta: 'Todavía no sé responder esa pregunta.',
  meses_sin_tarjeta: 'Solo una compra con tarjeta de crédito se puede pasar a meses.',
  correccion: 'Ese movimiento no lo puedo corregir así. Ábrelo en Movimientos.',
};

type FueraDeAlcance = Extract<ResultadoTexto, { resultado: 'fuera_de_alcance' }>['motivo'];

export function mensajeFueraDeAlcance(motivo: FueraDeAlcance): string {
  if (motivo === 'mueve_dinero') return 'No muevo dinero por ti: solo llevo la cuenta de lo que pasa.';
  if (motivo === 'asesoria_inversion') return 'No doy recomendaciones de inversión.';
  return 'Eso no lo puedo hacer. Te ayudo con tus gastos, ingresos y pagos.';
}

export const MENSAJE_NO_ENCONTRE = 'No encontré ese movimiento.';
export const MENSAJE_SIN_DUPLICADOS = 'No vi movimientos repetidos.';

/** "1 frase espera internet." — el indicador discreto del panel. */
export function mensajeEsperandoConexion(n: number): string {
  return n === 1
    ? '1 frase espera internet para interpretarla.'
    : `${n} frases esperan internet para interpretarlas.`;
}

/** "Corregí: Tacos $80 · Comida fuera · Cartera. Antes: Nu." */
export function mensajeCorregido(antes: ResumenTransaccion, despues: ResumenTransaccion): string {
  const cambios: string[] = [];
  if (antes.cuenta !== despues.cuenta) cambios.push(antes.porAsignar ? 'por asignar' : antes.cuenta);
  if (antes.monto !== despues.monto) cambios.push(formatearCentavos(antes.monto));
  if (antes.categoria !== despues.categoria && antes.categoria) cambios.push(antes.categoria);
  if (antes.fecha !== despues.fecha) cambios.push(etiquetaDiaMes(antes.fecha));
  const previo = cambios.length > 0 ? `. Antes: ${cambios.join(', ')}` : '';
  return `Corregí: ${resumenMovimiento(despues)}${previo}`;
}

export function mensajeAnulado(m: ResumenTransaccion): string {
  return `Borré: ${resumenMovimiento(m)}`;
}

/** "Listo: Renta $6,500. El próximo es el 1 nov." */
export function mensajeConfigurado(c: CompromisoConfigurado): string {
  const proximo = c.proxima ? `. El próximo es el ${etiquetaDiaMes(c.proxima)}` : '';
  return `Listo: ${c.concepto} ${formatearCentavos(c.monto)}${proximo}.`;
}

export function mensajePasarAMeses(m: ResumenTransaccion, meses: number): string {
  return `Anoté que ${(m.descripcion ?? 'la compra').toLowerCase()} va a ${meses} meses. Lo verás en tu tarjeta pronto.`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Coca $25 · Antojos · Efectivo" (02-UX §5). */
export function resumenMovimiento(m: ResumenMovimiento | ResumenTransaccion): string {
  const nombre = NOMBRE_TIPO_LIBRO[m.tipo] ?? 'Movimiento';
  const partes = [`${capitalizar(m.descripcion ?? nombre.toLowerCase())} ${formatearCentavos(m.monto)}`];
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

// ——— Modo explicar (`02 §22`) ———

export const MENSAJE_EXPLICANDO = 'Revisando tus datos…';
export const MENSAJE_EXPLICAR_SIN_RED =
  'Necesito internet para responderte eso. Pregúntame de nuevo cuando tengas conexión.';
export const MENSAJE_EXPLICAR_ERROR = 'No pude responderte ahora. Pregúntame de nuevo en un rato.';
export const MENSAJE_EXPLICAR_SOLO_PLUS =
  'Preguntarme lo que quieras sobre tu dinero es parte de Plus. Tu «hoy puedes» sigue en tu plan.';
