/** Redacción Ajustes › Avisos (`02 §12`, `02 §13`): tuteo; horarios y preferencias vienen de `servicios/`. */

export const SECCION_AVISOS = 'Avisos';

export const AVISOS_APAGADOS_EN_TELEFONO = 'Los avisos están apagados en tu teléfono.';
export const BTN_PERMITIR_AVISOS = 'Permitir avisos';
export const BTN_ABRIR_AJUSTES_TELEFONO = 'Abrir ajustes del teléfono';

export const AVISO_CORTE = 'Día de corte';
export const DESC_CORTE = 'El día que corta cada tarjeta.';

export const AVISO_LIMITE = 'Fecha límite de pago';
export const DESC_LIMITE =
  '3 días antes, con lo que tienes que pagar para no generar intereses.';

export const AVISO_RIESGO = 'Riesgo de no llegar';
export const DESC_RIESGO =
  'Si es más probable que tengas que tocar tu colchón antes de tu próximo ingreso.';

export const AVISO_RESPALDO = 'Respaldo pendiente';
export const DESC_RESPALDO = 'Si pasan 2 semanas sin respaldo, una vez por semana.';

export const AVISO_TANDA = 'Aportación de tanda';
export const DESC_TANDA = 'El día que te toca dar tu aportación.';

export const AVISO_COMPROMISO = 'Compromiso sin cubrir';
export const DESC_COMPROMISO = 'Un día después, si un pago fijo sigue sin registrarse.';

export const AVISO_INGRESO = 'Ingreso que no llegó';
export const DESC_INGRESO = '3 días después, si no vi llegar tu ingreso.';

export const ETIQUETA_HORA_AVISOS = 'Hora de los avisos';
export const EJEMPLO_HORA_AVISOS = '09:00';

export const ETIQUETA_HORARIO_SILENCIOSO = 'Horario silencioso';
export const DESC_HORARIO_SILENCIOSO =
  'En este horario no te aviso nada; lo que caiga ahí sale cuando termina.';
/** TalkBack: título y explicación en un solo foco (visible: título + {@link DESC_HORARIO_SILENCIOSO}). */
export const ETIQUETA_BLOQUE_HORARIO_SILENCIOSO = `${ETIQUETA_HORARIO_SILENCIOSO}. ${DESC_HORARIO_SILENCIOSO}`;

/** TalkBack cuando el teléfono bloquea avisos (visible: {@link AVISOS_APAGADOS_EN_TELEFONO}). */
export const ETIQUETA_AVISOS_APAGADOS_TELEFONO = `Aviso. ${AVISOS_APAGADOS_EN_TELEFONO}`;

export const ETIQUETA_SILENCIO_DESDE = 'Desde';
export const ETIQUETA_SILENCIO_HASTA = 'Hasta';
export const EJEMPLO_SILENCIO_DESDE = '22:00';
export const EJEMPLO_SILENCIO_HASTA = '08:00';

export const BTN_GUARDAR_HORARIO = 'Guardar horario';
/** TalkBack al guardar hora y silencio (`02 §12`). */
export const PISTA_GUARDAR_HORARIO = 'Guarda la hora de avisos y el horario silencioso';
/** TalkBack cuando el teléfono aún no concedió avisos (`02 §12`). */
export const PISTA_PERMITIR_AVISOS = 'Pide permiso para mandarte avisos en este teléfono';
/** TalkBack cuando el permiso está denegado (`02 §12`). */
export const PISTA_ABRIR_AJUSTES_AVISOS = 'Abre los ajustes del teléfono para activar avisos';

/** TalkBack live region como alerta si la hora no entendió el formato (`02 §12`). */
export const ERROR_FORMATO_HORA = 'Escribe las horas así: 22:00.';
/** TalkBack live region al guardar horario (`02 §12`). */
export const CONFIRMACION_HORARIO = 'Listo. Tus avisos ya usan este horario.';
