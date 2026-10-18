import type { Centavos, PlainDate } from '@cartera/core';
import {
  etiquetaDiaMes,
  type AnalisisEstadoCuenta,
  type PropuestaConciliacionEstado,
  type RenglonEstado,
} from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Botones de la pantalla (`02 §14`: verbo primero). */
export const BTN_ENTENDIDO = 'Entendido';
export const BTN_ABRIR = 'Abrir';
export const BTN_CANCELAR = 'Cancelar';
export const BTN_GUARDAR = 'Guardar';
export const BTN_AJUSTAR = 'Ajustar';
export const BTN_NO_AJUSTAR = 'No';
export const BTN_VER_TARJETA = 'Ver la tarjeta';

export const CHIP_MISMO = 'Es el mismo';
export const CHIP_OTRO = 'Es otro';

export const TITULO_DUDOSOS = '¿Ya los tenías?';

export const AVISO_NO_CUADRA =
  'Lo que leí no suma lo que dice tu banco: revisa los movimientos con tu PDF antes de guardar.';

export const MENSAJE_FALTAN_DUDOSOS = 'Contesta si ya tenías cada movimiento para poder guardar.';

/** Cuando el PDF cuadra pero no hay renglones nuevos que marcar (`02 §26`). */
export const TEXTO_SIN_NUEVOS = 'No hay movimientos nuevos que revisar.';

/** TalkBack: agrupa el resumen tras leer el PDF. */
export const ETIQUETA_RESUMEN_ESTADO = 'Resumen del estado de cuenta';
/** TalkBack: avisos cuando no se puede continuar (banco, tarjeta, PDF, etc.). */
export const ETIQUETA_AVISO_ESTADO = 'Aviso';

export const TITULO_PANTALLA = 'Estado de cuenta';

/** Selector del sistema (`app/estado-cuenta`) mientras la persona elige el PDF. */
export const MENSAJE_ELEGIR_PDF = 'Elige el PDF de tu estado de cuenta…';

/** Extracción en el teléfono (sin subir el archivo). */
export const MENSAJE_LEYENDO = 'Leyendo tu estado de cuenta…';

export const MENSAJE_CONTRASENA =
  'Tu PDF tiene contraseña. Escríbela para abrirlo; no la guardo.';
export const ETIQUETA_CONTRASENA_PDF = 'Contraseña del PDF';
export const ERROR_CONTRASENA_PDF = 'Esa contraseña no abre el PDF. Intenta de nuevo.';

/** Qué hacer tras CA-M15-03 (PDF escaneado). */
export const AYUDA_PDF_ESCANEADO =
  'Descarga el estado de cuenta desde la app o la página de tu banco: ese sí trae texto.';

/** `07 §8`: los PDF escaneados (imagen) no se soportan. Texto exacto de CA-M15-03. */
export const MENSAJE_ESCANEADO = 'No puedo leer PDFs escaneados';

export const MENSAJE_INVALIDO = 'No pude abrir ese archivo. Comparte el PDF que te manda tu banco.';
export const MENSAJE_DEMASIADO_GRANDE =
  'Ese PDF es demasiado grande para leerlo en el teléfono. Comparte solo el estado de cuenta del mes.';
export const MENSAJE_NO_DISPONIBLE = 'Por ahora solo puedo leer estados de cuenta en Android.';
export const MENSAJE_ERROR_GUARDAR = 'No pude guardar los movimientos. Intenta de nuevo.';

export const ETIQUETA_MOVIMIENTO_DESCONOCIDO = 'un movimiento';

export const MENSAJE_NO_RECONOCIDO_SIN_LISTA = 'Todavía no sé leer estados de cuenta de ese banco.';

/** Banco no soportado aún (`07 §8`). */
export function mensajeNoReconocido(bancos: readonly string[]): string {
  if (bancos.length === 0) return MENSAJE_NO_RECONOCIDO_SIN_LISTA;
  return `${MENSAJE_NO_RECONOCIDO_SIN_LISTA} Por ahora leo: ${bancos.join(', ')}.`;
}

export function mensajeIncompleto(banco: string): string {
  return `Es un estado de cuenta de ${banco}, pero no pude leer todos sus datos. No agregué nada.`;
}

export function mensajeSinTarjetas(banco: string): string {
  return `Es un estado de cuenta de ${banco}, pero no tienes esa tarjeta en Cartera. Agrégala y vuelve a compartir el PDF.`;
}

export function mensajeAnteriorAlAlta(corte: PlainDate, nombreTarjeta: string): string {
  return `Este estado de cuenta (corte ${etiquetaDiaMes(corte)}) es de antes de que agregaras la ${nombreTarjeta}: ya está en el saldo con que la diste de alta.`;
}

export function preguntaElegirTarjeta(
  banco: string,
  ultimos4: string | null | undefined,
  corte: PlainDate,
): string {
  const term = ultimos4 ? ` terminación ${ultimos4}` : '';
  return `¿De qué tarjeta es este estado de cuenta de ${banco}${term} (corte ${etiquetaDiaMes(corte)})?`;
}

export function etiquetaBotonTarjeta(nombre: string, ultimos4: string | null | undefined): string {
  return ultimos4 ? `${nombre} ••${ultimos4}` : nombre;
}

export function tituloNuevos(cantidad: number): string {
  return cantidad === 1 ? 'El que no tenía' : 'Los que no tenía';
}

export function mensajeRenglonesSinLeer(cantidad: number): string {
  return cantidad === 1
    ? '1 renglón no lo pude leer; revísalo en tu PDF.'
    : `${cantidad} renglones no los pude leer; revísalos en tu PDF.`;
}

export function mensajeAnteriores(cantidad: number): string {
  return cantidad === 1
    ? '1 es de antes de que agregaras la tarjeta; ya está en su saldo.'
    : `${cantidad} son de antes de que agregaras la tarjeta; ya están en su saldo.`;
}

export function etiquetaChipsDudoso(descripcion: string): string {
  return `¿${descripcion} ya lo tenías?`;
}

export function textoMovimientoExistente(
  descripcion: string | null | undefined,
  fecha: PlainDate,
  monto: Centavos,
): string {
  const titulo = descripcion ?? ETIQUETA_MOVIMIENTO_DESCONOCIDO;
  return `${titulo} del ${etiquetaDiaMes(fecha)} por ${formatearCentavos(monto)}`;
}

export function preguntaMismoMovimiento(
  descripcion: string | null | undefined,
  fecha: PlainDate,
  monto: Centavos,
): string {
  return `¿Es el mismo que ya tenías: ${textoMovimientoExistente(descripcion, fecha, monto)}?`;
}

export function etiquetaRenglonEstado(r: RenglonEstado): string {
  return `${NOMBRE_TIPO_RENGLON[r.tipo]}: ${r.descripcion} · ${etiquetaDiaMes(r.fecha)} · ${formatearCentavos(r.monto)}`;
}

export function lineaEncabezadoDudoso(descripcion: string, fecha: PlainDate): string {
  return `${descripcion} · ${etiquetaDiaMes(fecha)}`;
}

export function mensajeAjustado(nombreTarjeta: string): string {
  return `Listo: tu ${nombreTarjeta} quedó como dice tu banco.`;
}

export function mensajeGuardado(agregados: number, nombreTarjeta: string): string {
  if (agregados === 0) return `No agregué nada: tu ${nombreTarjeta} ya tenía todo.`;
  return agregados === 1
    ? `Agregué 1 movimiento a tu ${nombreTarjeta}.`
    : `Agregué ${agregados} movimientos a tu ${nombreTarjeta}.`;
}

/** "3 no los tenía" · "1 no lo tenía". */
function noLosTenia(n: number): string {
  if (n === 0) return 'ya tenías todos';
  return n === 1 ? '1 no lo tenía' : `${n} no los tenía`;
}

/**
 * `02 §26`: "Leí tu estado de cuenta de la Oro (corte 10 oct): 42 movimientos; 3 no los tenía; el saldo al corte
 * coincide". El saldo es el que tendría Cartera si guardas los que no tenía.
 */
export function resumenEstado(a: AnalisisEstadoCuenta): string {
  const partes = [a.total === 1 ? '1 movimiento' : `${a.total} movimientos`, noLosTenia(a.nuevos.length)];
  if (a.dudosos.length > 0) {
    partes.push(a.dudosos.length === 1 ? '1 quizá ya lo tenías' : `${a.dudosos.length} quizá ya los tenías`);
  }
  partes.push(a.coincide ? 'el saldo al corte coincide' : 'el saldo al corte no coincide');
  return `Leí tu estado de cuenta de la ${a.tarjeta.nombre} (corte ${etiquetaDiaMes(a.corte)}): ${partes.join('; ')}`;
}

/** Lo que se debe en palabras: "debes $4,350" o "tienes $120 a tu favor" (nunca se muestra un negativo). */
function deuda(c: Centavos): string {
  return c >= 0 ? `debes ${formatearCentavos(c)}` : `tienes ${formatearCentavos(-c)} a tu favor`;
}

/** `02 §26`: "Según tu banco debes $4,350; según Cartera, $4,200. ¿Ajusto?". */
export function preguntaConciliacion(p: PropuestaConciliacionEstado): string {
  const cartera =
    p.saldoCartera >= 0
      ? formatearCentavos(p.saldoCartera)
      : `${formatearCentavos(-p.saldoCartera)} a tu favor`;
  return `Según tu banco ${deuda(p.saldoBanco)}; según Cartera, ${cartera}. ¿Ajusto?`;
}

export const NOMBRE_TIPO_RENGLON = {
  cargo: 'Compra',
  comision: 'Comisión o interés',
  pago: 'Pago a la tarjeta',
  abono: 'Bonificación',
} as const;
