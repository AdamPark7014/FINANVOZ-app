import type { Centavos, PlainDate } from '@cartera/core';
import { etiquetaDiaMes, type AnalisisEstadoCuenta, type PropuestaConciliacionEstado } from '../../servicios';
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

export const MENSAJE_NO_CUADRA =
  'Lo que leí no suma lo que dice tu banco: revisa los movimientos con tu PDF antes de guardar.';
export const MENSAJE_FALTAN_DUDOSOS = 'Contesta si ya tenías cada movimiento para poder guardar.';

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
