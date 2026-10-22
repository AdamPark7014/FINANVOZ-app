/** Copy de Suscripciones (`02 §20`, tuteo). */

import { etiquetaHablada } from '../../ui/formato';

export const TITULO_PANTALLA = 'Suscripciones';
export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Regresa a Cuentas';

/** Entrada desde Cuentas (`02 §20`). */
export const BTN_SUSCRIPCIONES_CUENTAS = 'Ver mis suscripciones';

/** Con filas activas: acciones por suscripción. */
export const PISTA_AYUDA =
  'Conviértelas en compromiso y Hoy las aparta; o avisa si ya no las pagas o no son suscripción.';

/** TalkBack: la ayuda bajo el título cuando hay filas activas (`02 §15`). */
export function etiquetaAccesibleAyudaSuscripciones(): string {
  return `Opciones por suscripción. ${PISTA_AYUDA}`;
}

/** TalkBack: resumen mensual/anual con cifras en palabras (`02 §15`). */
export function etiquetaAccesibleResumenSuscripciones(textoResumen: string): string {
  return `Total en suscripciones activas. ${etiquetaHablada(textoResumen)}`;
}

/** Sin cargos recurrentes detectados (E14). */
export const TEXTO_SUSCRIPCIONES_VACIO =
  'Todavía no veo cargos que se repitan. Cuando un cobro llegue cada mes, cada semana o cada año, aparece aquí.';

/** Vacío de resumen: título de pantalla + copy para TalkBack (`02 §15`). */
export function etiquetaVacioSuscripciones(): string {
  return `${TITULO_PANTALLA}. ${TEXTO_SUSCRIPCIONES_VACIO}`;
}

/** Encabezado visible del acordeón de inactivas. */
export const TITULO_INACTIVAS = 'Ya no se cobran';

export const ICONO_INACTIVAS_CERRADA = '+';
export const ICONO_INACTIVAS_ABIERTA = '−';

/** Encabezado hablado del acordeón de inactivas (`02 §15`). */
export function etiquetaAccesibleInactivasEncabezado(cantidad: number): string {
  return cantidad === 1
    ? `${TITULO_INACTIVAS}, 1 suscripción`
    : `${TITULO_INACTIVAS}, ${cantidad} suscripciones`;
}

/** TalkBack: botón del acordeón; si está plegado incluye el detalle (`02 §15`). */
export function etiquetaAccesibleInactivasBoton(cantidad: number, texto: string, abierta: boolean): string {
  const encabezado = etiquetaAccesibleInactivasEncabezado(cantidad);
  if (abierta) return encabezado;
  return `${encabezado}. ${etiquetaHablada(texto)}`;
}

/** Detalle visible cuando el acordeón está abierto (`02 §15`). */
export function etiquetaAccesibleInactivasDetalle(texto: string): string {
  return etiquetaHablada(texto);
}

/** Pista TalkBack al expandir o cerrar la lista de inactivas (`02 §15`). */
export function pistaInactivasSuscripciones(abierta: boolean): string {
  return abierta ? 'Pliega el detalle' : 'Despliega el detalle';
}

/** TalkBack: monto de la fila, con aumento de precio si aplica (`02 §15`). */
export function etiquetaAccesibleMontoSuscripcion(textoMonto: string, textoAntes?: string | null): string {
  const visible = textoAntes ? `${textoMonto} (${textoAntes})` : textoMonto;
  return `Monto. ${etiquetaHablada(visible)}`;
}

/** TalkBack: cuándo viene el siguiente cargo en la fila (`02 §15`). */
export function etiquetaAccesibleProximoSuscripcion(textoProximo: string): string {
  return `Próximo cargo: ${textoProximo}`;
}

export const ETIQUETA_NOMBRE = 'Nombre';
export const AYUDA_NOMBRE = 'Así la verás en la lista';
export const ETIQUETA_EDITAR_NOMBRE = 'Editar nombre';
export const PISTA_EDITAR_NOMBRE = 'Cambia cómo la ves en la lista';
export const ETIQUETA_GUARDAR_NOMBRE = 'Guardar nombre';
export const PISTA_GUARDAR_NOMBRE = 'Guarda el nombre que escribiste';

export const TEXTO_HOY_APARTA = 'Hoy ya la aparta.';

/** TalkBack: estado compromiso en la fila, con nombre para contexto (`02 §15`). */
export function etiquetaAccesibleHoyApartaSuscripcion(nombre: string): string {
  return `${nombre}. ${TEXTO_HOY_APARTA}`;
}
export const ETIQUETA_COMPROMISO = 'Convertir en compromiso';
export const PISTA_COMPROMISO = 'Hoy aparta el monto antes de cada cargo';
export const ETIQUETA_CANCELADA = 'Ya la cancelé';
export const PISTA_CANCELADA = 'La quito de la lista; si vuelve a cobrarse, te aviso aquí';
export const ETIQUETA_NO_ES = 'No es suscripción';
export const PISTA_NO_ES = 'Dejo de tratarla como cargo recurrente';

export type AccionSuscripcion = 'compromiso' | 'cancelada' | 'no_es';

/** "Ya la cancelé" y "No es suscripción" no tienen Deshacer: se confirman en la fila. */
export const BTN_SI_CANCELADA = 'Sí, ya la cancelé';
export const BTN_SI_NO_ES = 'Sí, quitarla';
export const BTN_NO_DEJALA = 'No, déjala';
export const PISTA_NO_DEJALA = 'Cierra la pregunta sin cambiar nada';
export function textoConfirmarCancelada(nombre: string, apartada: boolean): string {
  return apartada
    ? `¿Ya cancelaste ${nombre}? La quito de la lista y Hoy deja de apartarla. Si vuelve a cobrarse, reaparece aquí.`
    : `¿Ya cancelaste ${nombre}? La quito de la lista. Si vuelve a cobrarse, reaparece aquí.`;
}
export function textoConfirmarNoEs(nombre: string): string {
  return `¿${nombre} no es una suscripción? La quito de la lista y no vuelvo a mostrarla aunque se repita.`;
}

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
