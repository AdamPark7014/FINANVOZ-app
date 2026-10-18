/** Copy de captura automática y por revisar (`02 §6`, `02 §14`, tuteo). */

import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

export const TITULO_CAPTURAS_POR_REVISAR = 'Capturas por revisar';
export const INTRO_CAPTURAS_POR_REVISAR =
  'Vienen de avisos de tu banco. Confírmalas o corrige categoría y meses.';
export const TEXTO_CAPTURAS_POR_REVISAR_VACIO =
  'Todo al día. Cuando un aviso no quede claro, lo verás aquí para confirmarlo.';

/** TalkBack: título de sección + copy del estado vacío (`02 §15`). */
export function etiquetaVacioCapturasPorRevisar(): string {
  return `${TITULO_CAPTURAS_POR_REVISAR}. ${TEXTO_CAPTURAS_POR_REVISAR_VACIO}`;
}

/** TalkBack: título de sección + intro cuando hay pendientes (`02 §15`). */
export function etiquetaIntroCapturasPorRevisar(): string {
  return `${TITULO_CAPTURAS_POR_REVISAR}. ${INTRO_CAPTURAS_POR_REVISAR}`;
}

/** TalkBack en CTAs de capturas por revisar (`02 §6`, `02 §15`). */
export const PISTA_REGISTRAR_AVISO = 'Abre el formulario para anotar este aviso a mano';
export const PISTA_YA_REGISTRE_AVISO = 'Quita este aviso de la lista; ya lo anotaste';
export const PISTA_DESCARTAR_AVISO = 'Quita este aviso sin registrarlo';
export const PISTA_CONFIRMAR_CAPTURA = 'Confirma que la captura está correcta';
export const PISTA_CAPTURA_DE_CONTADO = 'Indica que no fue a meses sin intereses';
export const PISTA_CAMBIAR_CATEGORIA_CAPTURA = 'Elige otra categoría para esta captura';

/** Tarjeta de Hoy tras restaurar un respaldo (`TarjetaReactivarCaptura`). */
export const TITULO_REACTIVAR_CAPTURA = 'Vuelve a activar la lectura de notificaciones';
export const CUERPO_REACTIVAR_CAPTURA =
  'Recuperé tus datos, pero en este teléfono todavía no puedo leer los avisos de tu banco.';

/** TalkBack: título + cuerpo de la tarjeta reactivar (`02 §15`). */
export function etiquetaCuerpoReactivarCaptura(): string {
  return `${TITULO_REACTIVAR_CAPTURA} ${CUERPO_REACTIVAR_CAPTURA}`;
}

/** TalkBack: tarjeta de Hoy tras restaurar (`TarjetaReactivarCaptura`). */
export const PISTA_DESCARTAR_REACTIVAR_CAPTURA = 'Deja la captura apagada y quita esta tarjeta';
/** TalkBack: tarjeta captura inactiva (RF-CAP-07). */
export const PISTA_REVISAR_ACCESO_CAPTURA =
  'Abre ajustes del teléfono para revisar el acceso a notificaciones';

export const TITULO_CAPTURA_INACTIVA =
  'No he visto notificaciones de tu banco en 3 días. Revisa que la captura siga activa.';

/** TalkBack: aviso + guía por marca del teléfono (`TarjetaCapturaInactiva`). */
export function etiquetaGuiaCapturaInactiva(guia: string): string {
  return `${TITULO_CAPTURA_INACTIVA} ${guia}`;
}

export const TITULO_SIN_COMERCIO = 'Movimiento de tu banco';
export const ETIQUETA_SIN_CATEGORIA = 'sin categoría';
export const AVISO_SIN_TEXTO =
  'El aviso no traía detalle. Si fue un gasto o un ingreso, regístralo tú.';

/** Divulgación destacada antes del acceso a notificaciones (`08 §3.1`, RF-PRI-02). */
export const DIVULGACION_CAPTURA = {
  titulo: 'Registrar tus compras automáticamente',
  parrafos: [
    'Finanvoz puede leer las notificaciones de las apps de banco que elijas para registrar tus compras, retiros y transferencias sin que tengas que anotarlas.',
    'Solo leemos las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se guardan.',
    'El contenido se procesa en tu teléfono y no se envía a nuestros servidores.',
    'Puedes desactivarlo cuando quieras en Ajustes.',
  ],
} as const;

export const ETIQUETA_NO_DISPONIBLE = 'No disponible en este teléfono';
export const CUERPO_NO_DISPONIBLE =
  'Finanvoz anota tus compras con los avisos de tu banco en Android, con la app instalada desde la tienda.';
export const ALTERNATIVA_NO_DISPONIBLE = 'Por ahora, dicta o escribe tus gastos: «tacos 80 en efectivo».';

export const TITULO_PERMISO_NOTIFICACIONES = 'Acceso a notificaciones';
export const PERMISO_INSTRUCCION =
  'En Ajustes del teléfono, busca Finanvoz y activa «Permitir acceso a notificaciones». Luego regresa aquí.';
export const PERMISO_DENEGADO =
  'Todavía no tengo acceso a tus notificaciones. Revísalo en Ajustes del teléfono y vuelve a intentar.';
export const PERMISO_AYUDA_ANDROID =
  'Si Android no te deja activarlo, abre la información de la app, toca el menú ⋮ y elige «Permitir ajustes restringidos».';

/** TalkBack: título + instrucción o aviso de denegado + ayuda Android (`02 §15`). */
export function etiquetaPermisoCaptura(denegado: boolean): string {
  const cuerpo = denegado ? PERMISO_DENEGADO : PERMISO_INSTRUCCION;
  return `${TITULO_PERMISO_NOTIFICACIONES}. ${cuerpo} ${PERMISO_AYUDA_ANDROID}`;
}

export const TEXTO_SIN_APPS_BANCO =
  'No encontré apps de banco que reconozca en tu teléfono. Cuando instales una, actívala en Ajustes.';
export const TITULO_ELEGIR_APPS = '¿Qué apps de banco leo?';
export const INTRO_ELEGIR_APPS = 'Solo leo las que marques.';

export function etiquetaSinAppsBanco(): string {
  return `${TITULO_ELEGIR_APPS}. ${TEXTO_SIN_APPS_BANCO}`;
}

export const LISTA_CAPTURA_ACTIVA = 'La captura automática está activa.';
export const LISTA_CAPTURA_APPS = (nombres: readonly string[]) =>
  `Listo: anotaré lo que avisen ${nombres.join(', ')}.`;
export const LISTA_CAPTURA_POR_REVISAR =
  'Lo que no entienda queda en Movimientos → Por revisar.';

/** Preguntas de captura en Hoy (`02 §6`, `PreguntasCaptura.tsx`). */

/** Meses comunes de «¿Fue a meses?» (`02 §6`). */
export const MESES_CAPTURA = ['3', '6', '9', '12', '18', '24'] as const;

export const ETIQUETA_OTRA_PERSONA = 'Otra persona';
export const EJEMPLO_NOMBRE_PERSONA = 'Juan';
export const BTN_GUARDAR = 'Guardar';
export const BTN_CANCELAR = 'Cancelar';

export const PREGUNTA_A_CUAL = '¿A cuál?';
export const PREGUNTA_QUE_PAGASTE = '¿Qué pagaste?';
export const PREGUNTA_DE_CUAL = '¿De cuál?';
export const PREGUNTA_SE_LO_DEBES = '¿Se lo tienes que pagar?';
export const PREGUNTA_A_QUIEN_PRESTASTE = '¿A quién le prestaste?';
export const PREGUNTA_QUIEN_PAGO = '¿Quién la pagó?';
export const PREGUNTA_ES_ALGUNA_DE_ESTAS = '¿Es alguna de estas?';

export const ETIQUETA_SALIDA_CUENTA = 'A otra cuenta mía';
export const ETIQUETA_SALIDA_PRESTAMO = 'Le presté';
export const ETIQUETA_SALIDA_GASTO = 'Pagué algo';
export const ETIQUETA_SALIDA_OTRO = 'Otro';
export const ETIQUETA_CUENTA_EXTERNA = 'Una que no llevo aquí';

export const ETIQUETA_PAGO_CUENTA = 'De una de mis cuentas';
export const ETIQUETA_PAGO_EXTERNA = 'De una cuenta que no llevo aquí';
export const ETIQUETA_PAGO_ALGUIEN = 'Alguien más la pagó';
export const ETIQUETA_DEBE_SI = 'Sí, se lo debo';
export const ETIQUETA_DEBE_NO = 'No, me lo regalaron';

export const BTN_SI_AGREGALA = 'Sí, agrégala';
export const BTN_AGREGAR_CUENTA = 'Agregar la cuenta';
export const BTN_NO_ES_MIA = 'No es mía';
export const BTN_GUARDAR_TARJETA = 'Guardar tarjeta';
export const BTN_GUARDAR_CUENTA = 'Guardar cuenta';
export const BTN_SI_ES_MISMO = 'Sí, es el mismo';
export const BTN_NO_ES_OTRO = 'No, es otro';
export const ETIQUETA_MSI_NO = 'No';

export const ETIQUETA_NOMBRE_CUENTA = 'Nombre';
export const ETIQUETA_SALDO_HOY = '¿Cuánto tiene hoy?';
export const AYUDA_SALDO_HOY =
  'El saldo que ves hoy en tu app; ya incluye este movimiento.';

export const ERROR_NOMBRE_CUENTA = 'Ponle un nombre a la cuenta.';
export const ERROR_SALDO_CUENTA = 'Escribe cuánto tiene la cuenta hoy.';
export const ERROR_GUARDAR_CUENTA = 'No pude guardar eso. Revisa los datos e intenta de nuevo.';

export const AVISO_SALIDA_OTRO = 'Va. Lo dejo en Por revisar.';
export const AVISO_SALIDA_ENTRE_CUENTAS = 'Listo: lo cuento como un movimiento entre tus cuentas.';
export const AVISO_SALIDA_PRESTAMO = 'Listo: lo anoté como un préstamo.';
export const AVISO_SALIDA_GASTO = 'Listo: lo anoté como un gasto.';
export const AVISO_PAGO_TARJETA = 'Listo: registré el pago de tu tarjeta.';
export const AVISO_PAGO_REGALO = 'Listo: lo anoté como un regalo.';
export const AVISO_PAGO_DEBES = 'Listo: anoté que se lo debes.';
export const AVISO_CUENTA_ASOCIADA = 'Listo: ya sé de qué cuenta es.';
export const AVISO_CUENTA_AGREGADA = 'Listo: agregué la cuenta.';
export const AVISO_CUENTA_NO_MIA = 'Va. No registré ese movimiento.';
export const AVISO_DUPLICADO_MISMO = 'Listo: lo dejé una sola vez.';
export const AVISO_DUPLICADO_OTRO = 'Listo: lo registré aparte.';
export const AVISO_MSI_NO = 'Va. Lo dejo como cargo normal.';

export const TITULO_FUE_A_MESES = '¿Fue a meses?';
export const DUPLICADO_SIN_DESCRIPCION = 'lo que anotaste';

export const CUENTA_NUEVA_UNA_TARJETA = 'una tarjeta';
export const CUENTA_NUEVA_UNA_CUENTA = 'una cuenta';

export function tituloSalidaSinPareja(monto: Centavos): string {
  return `¿A quién le mandaste ${formatearCentavos(monto)}?`;
}

export function detalleSalidaSinPareja(cuenta: string, fechaEtiqueta: string): string {
  return `Salió de ${cuenta} el ${fechaEtiqueta} y no vi a dónde llegó.`;
}

export function tituloPagoSinOrigen(monto: Centavos, tarjeta: string): string {
  return `¿De dónde salió el pago de ${formatearCentavos(monto)} a tu ${tarjeta}?`;
}

export function detallePagoSinOrigen(fechaEtiqueta: string): string {
  return `Llegó el ${fechaEtiqueta} y no vi de qué cuenta salió.`;
}

export function tituloCuentaNuevaDetectada(
  que: typeof CUENTA_NUEVA_UNA_TARJETA | typeof CUENTA_NUEVA_UNA_CUENTA,
  ultimos4: string,
  banco: string,
): string {
  return `Detecté ${que} ••${ultimos4} de ${banco}. ¿La agrego?`;
}

export function tituloCuentaNuevaSinUltimos4(banco: string): string {
  return `Llegó un aviso de ${banco}. ¿En qué cuenta fue?`;
}

export function detalleCuentaNueva(monto: Centavos, fechaEtiqueta: string): string {
  return `${formatearCentavos(monto)} · ${fechaEtiqueta}`;
}

export function etiquetaMesesChip(meses: string): string {
  return `${meses} meses`;
}

export function detalleFueAMeses(
  prefijoComercio: string,
  monto: Centavos,
  tarjeta: string,
  fechaEtiqueta: string,
): string {
  return `${prefijoComercio}${formatearCentavos(monto)} con tu ${tarjeta} · ${fechaEtiqueta}`;
}

export function descripcionDuplicado(descripcion: string | null | undefined): string {
  return descripcion ? `«${descripcion}»` : DUPLICADO_SIN_DESCRIPCION;
}

export function tituloDuplicado(que: string, fechaEtiqueta: string): string {
  return `¿Es lo mismo que ${que} del ${fechaEtiqueta}?`;
}

export function detalleDuplicado(
  monto: Centavos,
  fechaEtiqueta: string,
  montoDictado: Centavos,
): string {
  return `Tu banco avisó de ${formatearCentavos(monto)} el ${fechaEtiqueta}; anotaste ${formatearCentavos(montoDictado)}.`;
}
