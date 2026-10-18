/** Copy de Suscripciones (`02 §20`, tuteo). */

export const TITULO_PANTALLA = 'Suscripciones';
export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Regresa a Cuentas';

/** Con filas activas: acciones por suscripción. */
export const PISTA_AYUDA =
  'Conviértelas en compromiso y Hoy las aparta; o avisa si ya no las pagas o no son suscripción.';

/** Sin cargos recurrentes detectados (E14). */
export const TEXTO_SUSCRIPCIONES_VACIO =
  'Todavía no veo cargos que se repitan. Cuando un cobro llegue cada mes, cada semana o cada año, aparece aquí.';

export const ETIQUETA_NOMBRE = 'Nombre';
export const AYUDA_NOMBRE = 'Así la verás en la lista';
export const ETIQUETA_EDITAR_NOMBRE = 'Editar nombre';
export const PISTA_EDITAR_NOMBRE = 'Cambia cómo la ves en la lista';
export const ETIQUETA_GUARDAR_NOMBRE = 'Guardar nombre';
export const PISTA_GUARDAR_NOMBRE = 'Guarda el nombre que escribiste';

export const TEXTO_HOY_APARTA = 'Hoy ya la aparta.';
export const ETIQUETA_COMPROMISO = 'Convertir en compromiso';
export const PISTA_COMPROMISO = 'Hoy aparta el monto antes de cada cargo';
export const ETIQUETA_CANCELADA = 'Ya la cancelé';
export const PISTA_CANCELADA = 'La quito de la lista; si vuelve a cobrarse, te aviso aquí';
export const ETIQUETA_NO_ES = 'No es suscripción';
export const PISTA_NO_ES = 'Dejo de tratarla como cargo recurrente';

export type AccionSuscripcion = 'compromiso' | 'cancelada' | 'no_es';

export function mensajeAccionSuscripcion(accion: AccionSuscripcion, nombre: string): string {
  switch (accion) {
    case 'compromiso':
      return `Listo: Hoy aparta tu ${nombre} antes de cada cargo.`;
    case 'cancelada':
      return `Ya no te muestro ${nombre}. Si vuelve a cobrarse, te aviso aquí.`;
    case 'no_es':
      return `Listo: ${nombre} ya no aparece como suscripción.`;
  }
}

export function mensajeNombreGuardado(nombre: string): string {
  return `Listo: la llamo ${nombre}.`;
}
