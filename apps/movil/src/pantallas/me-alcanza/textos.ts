/** Copy de «¿Me alcanza?» (`02 §9`, `02 §14`: tuteo, qué pasó + qué hacer). */

export { MENSAJE_DATOS_INSUFICIENTES } from '../../servicios/probabilidad';

export const TITULO = '¿Me alcanza?';

export const ETIQUETA_PRECIO = '¿Cuánto cuesta?';
export const ETIQUETA_DESCRIPCION = '¿Qué es? (opcional)';
export const EJEMPLO_DESCRIPCION = 'unos tenis';
export const PREGUNTA_MSI = '¿Lo quieres a meses sin intereses?';
export const ETIQUETA_MSI_TU_DIME = 'Tú dime';
export const ETIQUETA_MSI_OTRO = 'Otro';
export const ETIQUETA_MESES_MANUAL = '¿A cuántos meses?';

export function etiquetaChipMeses(meses: string): string {
  return `${meses} meses`;
}

export const TEXTO_CALCULANDO = 'Estoy revisando tus opciones…';
/** TalkBack mientras calcula (`02 §19`): mismo copy que el texto visible. */
export const ETIQUETA_CALCULANDO = TEXTO_CALCULANDO;
export const ETIQUETA_PROGRESO = 'Avance del cálculo';

export const ETIQUETA_OPCION_RECOMENDADA = 'Lo más seguro';
export const SUFIJO_ACCESIBILIDAD_RECOMENDADA = ', lo más seguro';
export const TEXTO_PARCIAL_HORIZONTE = 'Algunos pagos caen después de 2 años: no los revisé.';

/**
 * Una línea al terminar el cálculo (`02 §19`); el detalle de escenarios se explora en pantalla.
 * Solo se usa con `AccessibilityInfo.announceForAccessibility` y el resumen accesible.
 */
export function anuncioResultadoOk(titulo: string, frase: string, etiqueta: string | null): string {
  const partes = [titulo, frase];
  if (etiqueta) partes.push(etiqueta);
  return partes.join('. ');
}

/** TalkBack cuando aún no hay bastante historial (`02 §19`). */
export function anuncioDatosInsuficientes(titulo: string, mensaje: string): string {
  return `${titulo}. ${mensaje}`;
}

/** TalkBack al leer un escenario: etiqueta, probabilidad, recomendación y notas cortas. */
export function etiquetaEscenarioAccesible(e: {
  readonly etiqueta: string;
  readonly porcentaje: string;
  readonly recomendado: boolean;
  readonly detalle?: string;
  readonly parcial?: boolean;
}): string {
  let s = `${e.etiqueta}: ${e.porcentaje}`;
  if (e.recomendado) s += SUFIJO_ACCESIBILIDAD_RECOMENDADA;
  if (e.detalle) s += `. ${e.detalle}`;
  if (e.parcial) s += `. ${TEXTO_PARCIAL_HORIZONTE}`;
  return s;
}

/** Pie cuando aún no hay bastante historial de gastos (vacío / datos insuficientes). */
export const AYUDA_DATOS_INSUFICIENTES =
  'Sigue registrando tus gastos un par de semanas y vuelve a calcular.';

export function etiquetaVacioDatosInsuficientes(): string {
  return `${TITULO}. ${AYUDA_DATOS_INSUFICIENTES}`;
}

export const MENSAJE_CANCELADO = 'Cancelé el cálculo. Puedes cambiar los datos y volver a calcular.';

export const ERROR_MESES = 'Escribe cuántos meses, entre 2 y 48.';
export const ERROR_PRECIO = 'Escribe un precio mayor a $0.';

export const ERROR_CALCULO = 'No pude calcularlo. Toca Intentar de nuevo o cambia los datos.';

export const MENSAJE_SIN_AVISOS =
  'No puedo programar avisos en este teléfono. Anótalo en tu calendario si lo necesitas.';

export const MENSAJE_PERMISO_AVISOS =
  'Activa los avisos en los ajustes de tu teléfono para que te lo recuerde.';

export const ERROR_RECORDATORIO = 'No pude programar el aviso. Intenta de nuevo.';

/** CTAs de «¿Me alcanza?» (`02 §9`): formulario, resultado y acciones post-cálculo. */

export const BTN_CERRAR = 'Cerrar';
/** TalkBack: más contexto que el botón «Cerrar». */
export const ACCESIBILIDAD_CERRAR = 'Cerrar simulación ¿Me alcanza?';
export const BTN_CALCULAR = 'Calcular';
/** TalkBack en formulario (`02 §19`). */
export const PISTA_CALCULAR = 'Calcula si te alcanza con tu dinero libre y tus pagos pendientes';
export const BTN_CANCELAR = 'Cancelar';
/** TalkBack mientras calcula (`02 §19`). */
export const PISTA_CANCELAR = 'Detiene el cálculo y vuelve al formulario';
export const BTN_INTENTAR_DE_NUEVO = 'Intentar de nuevo';
/** TalkBack tras fallo de cálculo (`02 §19`). */
export const PISTA_REINTENTAR_ME_ALCANZA = 'Vuelve a calcular con los mismos datos';
export const BTN_CAMBIAR_DATOS = 'Cambiar los datos';
/** TalkBack tras fallo de cálculo (`02 §19`). */
export const PISTA_CAMBIAR_DATOS_ME_ALCANZA = 'Vuelve al formulario para editar precio o meses';
export const BTN_LISTO = 'Listo';
/** TalkBack: cierra cuando aún no hay bastante historial. */
export const ACCESIBILIDAD_LISTO = 'Listo, cerrar simulación ¿Me alcanza?';
/** TalkBack en vacío de datos insuficientes (`02 §19`). */
export const PISTA_LISTO = 'Cierra la pantalla y vuelve a donde estabas';
export const BTN_COMO_LO_CALCULE = 'Cómo lo calculé';
export const BTN_OCULTAR_COMO_LO_CALCULE = 'Ocultar cómo lo calculé';
/** TalkBack al desplegar el detalle (`02 §19`). */
export const PISTA_MOSTRAR_COMO_LO_CALCULE = 'Muestra el detalle de la simulación';
/** TalkBack al ocultar el detalle (`02 §19`). */
export const PISTA_OCULTAR_COMO_LO_CALCULE = 'Oculta el detalle de la simulación';
export const BTN_VER_MOVIMIENTOS = 'Ver los movimientos';
/** TalkBack en el detalle de la simulación (`02 §19`). */
export const PISTA_VER_MOVIMIENTOS = 'Abre los movimientos que usó esta simulación';
export const BTN_LO_COMPRE = 'Lo compré';
/** TalkBack en escenario (`02 §19`). */
export function pistaLoCompre(etiqueta: string): string {
  return `Registra la compra: ${etiqueta}`;
}
/** TalkBack al programar recordatorio (`02 §19`). */
export const PISTA_RECUERDAMELO = 'Programa un aviso en tu teléfono para ese día';
export const BTN_HACER_OTRA_CUENTA = 'Hacer otra cuenta';
/** TalkBack en resultado (`02 §19`). */
export const PISTA_HACER_OTRA_CUENTA = 'Vuelve al formulario para simular otra compra';
export const BTN_DESHACER = 'Deshacer';

export const MENSAJE_AVISO_RECORDATORIO = 'Listo: te lo recuerdo ese día.';
export const TEXTO_RECORDATORIO_PROGRAMADO = 'Te lo recuerdo ese día.';
export const TEXTO_YA_LO_REGISTRE = 'Ya lo registré.';
