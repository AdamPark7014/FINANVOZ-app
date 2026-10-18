import type { Centavos } from '@cartera/core';
import type { FrecuenciaTanda, MovimientoTanda, RondaTandaVista, TandaYaEmpezada } from '../../servicios';
import { cifraEnPalabras, formatearCentavos } from '../../ui';

/** Copy de tandas (`02 §18`, tuteo). */

/** Lista (`Cuentas → Tandas`). */
export const TITULO_TANDAS = 'Tandas';
/** Entrada desde Cuentas (`02 §18`). */
export const BTN_TANDAS_CUENTAS = 'Ver mis tandas';
export const ETIQUETA_NUEVA_TANDA = 'Nueva tanda';
export const PISTA_NUEVA_TANDA = 'Crea una tanda con aportación, turno y fechas';
export const ETIQUETA_VER_CALENDARIO = 'Ver calendario';
export const PISTA_VER_CALENDARIO = 'Abre el calendario y las rondas de esta tanda';

/** Tarjetas de Hoy (debe coincidir con `servicios/tandas.ts`). */
export const PREGUNTA_YA_DISTE = '¿Ya diste tu tanda?';
export const PREGUNTA_HOY_COBRO = 'Hoy te toca cobrar tu tanda.';
export const ETIQUETA_TODAVIA_NO = 'Todavía no';
/** TalkBack al posponer la aportación en Hoy (`02 §18`). */
export const PISTA_TODAVIA_NO_APORTACION =
  'Pospone el registro; la sigo apartando y te pregunto mañana';
/** TalkBack al posponer el cobro en Hoy (`02 §18`). */
export const PISTA_TODAVIA_NO_COBRO = 'Pospone el cobro; te pregunto mañana';
export const MENSAJE_TODAVIA_NO_APORTACION = 'La sigo apartando. Te pregunto mañana.';
export const MENSAJE_TODAVIA_NO_COBRO = 'Va. Te pregunto mañana.';

export const PREGUNTA_CUENTA_SALIO = '¿De qué cuenta salió?';
export const PREGUNTA_CUENTA_LLEGO = '¿A qué cuenta llegó?';

/** Formulario nueva tanda. */
export const ETIQUETA_NOMBRE_OPCIONAL = 'Nombre (opcional)';
export const EJEMPLO_NOMBRE_TANDA = 'Tanda de la oficina';
export const ETIQUETA_APORTACION = '¿Cuánto das en cada ronda?';
export const ETIQUETA_FRECUENCIA = '¿Cada cuándo?';
export const ETIQUETA_PARTICIPANTES = '¿Cuántos son?';
export const ETIQUETA_TURNO = '¿Qué número te toca?';
export const ETIQUETA_PRIMERA_FECHA = 'Primera fecha';
export const EJEMPLO_FECHA = '16/10/2026';
export const ETIQUETA_CUENTA_APORTACION_OPCIONAL = '¿De dónde sale tu aportación? (opcional)';
export const TITULO_YA_EMPEZO = 'Esta tanda ya empezó.';
export const ETIQUETA_APORTACIONES_HECHAS = '¿Cuántas aportaciones llevas?';
export const ETIQUETA_YA_TE_TOCO = '¿Ya te tocó?';
export const SUFIJO_RONDAS_NO_APARTO = 'Esas rondas no las vuelvo a apartar.';
export const ETIQUETA_GUARDAR_TANDA = 'Guardar tanda';
/** TalkBack al guardar una tanda nueva (`02 §18`). */
export const PISTA_GUARDAR_TANDA = 'Guarda la tanda y aparto cada aportación el día que toca';
/** TalkBack al cerrar el formulario sin guardar (`02 §18`). */
export const PISTA_CANCELAR_FORMULARIO = 'Cierra el formulario sin guardar la tanda';
/** TalkBack al salir del flujo de cobro sin registrar (`02 §18`). */
export const PISTA_CANCELAR_COBRO = 'Cierra sin registrar el cobro';
/** TalkBack al cerrar edición sin guardar (`02 §18`). */
export const PISTA_CANCELAR_EDICION = 'Cierra la edición sin guardar cambios';
/** TalkBack al volver del diálogo de archivar (`02 §18`). */
export const PISTA_CANCELAR_ARCHIVAR = 'Vuelve al detalle sin archivar';

export const OPCIONES_SI_NO = [
  { valor: 'si' as const, etiqueta: 'Sí' },
  { valor: 'no' as const, etiqueta: 'No' },
];

export const ERROR_APORTACION = 'Escribe cuánto das en cada ronda.';
export const ERROR_FRECUENCIA = 'Dime cada cuándo das tu tanda.';
export const ERROR_PARTICIPANTES = 'Escribe cuántos son en la tanda (de 2 a 50).';
export const errorTurno = (max: number) => `Escribe tu turno, del 1 al ${max}.`;
export const ERROR_FECHA_INICIO = 'Escribe la primera fecha así: 16/10/2026.';
export const ERROR_APORTACIONES_HECHAS =
  'Escribe cuántas aportaciones llevas, o déjalo como te lo propuse.';
export const ERROR_GUARDAR_TANDA = 'No pude guardar la tanda. Revisa los datos.';

export const TEXTO_COMPROMISO_APORTACION =
  'Cada aportación es un compromiso: la aparto de tu dinero libre el día que toca.';

export function textoResumenCobro(
  cobro: Centavos,
  etiquetaCobro: string,
  turno: number,
  participantes: number,
): string {
  return `Cobras ${formatearCentavos(cobro)} el ${etiquetaCobro} (ronda ${turno} de ${participantes}).`;
}

export function textoYaEmpezoCompleto(y: TandaYaEmpezada): string {
  return `${textoYaEmpezo(y)}. ${SUFIJO_RONDAS_NO_APARTO}`;
}

export function textoSubtituloListaConProxima(
  aportacion: Centavos,
  etiquetaProxima: string,
  etiquetaCobro: string,
): string {
  return `${formatearCentavos(aportacion)} el ${etiquetaProxima} · cobras el ${etiquetaCobro}`;
}

export function textoSubtituloListaSinProxima(etiquetaCobro: string): string {
  return `Ya diste todas tus aportaciones · cobras el ${etiquetaCobro}`;
}

/** Aviso al guardar desde voz o formulario. */
export const MENSAJE_TANDA_GUARDADA =
  'Listo: guardé tu tanda. Aparto cada aportación el día que toca.';

/** Detalle (`tandas/[id]`). */
export const ETIQUETA_VOLVER = 'Volver';
/** Lista (`Cuentas → Tandas`). */
export const PISTA_VOLVER = 'Regresa a Cuentas';
/** Detalle de una tanda. */
export const PISTA_VOLVER_DETALLE = 'Regresa a la lista de tandas';
export const TEXTO_TANDA_NO_ENCONTRADA = 'No encontré esa tanda.';
/** TalkBack cuando el id no existe (`02 §18`, como detalle de tarjeta). */
export const ACCESIBILIDAD_TANDA_NO_ENCONTRADA =
  'No encontré esa tanda. Usa Volver para regresar a la lista de tandas.';
export const TEXTO_TANDA_ARCHIVADA = 'Archivada · ya no aparto aportaciones';
/** TalkBack al ver una tanda archivada (`02 §18`). */
export const ACCESIBILIDAD_TANDA_ARCHIVADA =
  'Archivada. Ya no aparto aportaciones futuras. Lo registrado se queda.';
export const ETIQUETA_YA_LA_DI = 'Ya la di';
/** TalkBack al registrar la aportación del día (`02 §18`). */
export const PISTA_YA_LA_DI = 'Registra que diste tu aportación de esta ronda';
export const ETIQUETA_ME_TOCO = 'Me tocó la tanda';
/** TalkBack al cobrar tu turno (`02 §18`). */
export const PISTA_ME_TOCO = 'Registra el cobro; no cuenta como ingreso';
export const TITULO_CALENDARIO = 'Calendario';
export const SUFIJO_TU_TURNO = ' · tu turno';
export const ETIQUETA_EDITAR_NOMBRE_CUENTA = 'Editar nombre o cuenta';
/** TalkBack al abrir edición de nombre o cuenta (`02 §18`). */
export const PISTA_EDITAR_NOMBRE_CUENTA = 'Cambia el nombre o la cuenta de aportación';
export const ETIQUETA_ARCHIVAR_TANDA = 'Archivar tanda';
/** TalkBack al iniciar archivar (`02 §18`). */
export const PISTA_ARCHIVAR_TANDA = 'Quita la tanda de la lista y cancela aportaciones futuras';
/** TalkBack al confirmar archivar. */
export const PISTA_CONFIRMAR_ARCHIVAR = 'Confirma archivar; lo ya registrado se queda';
export const ETIQUETA_GUARDAR_CAMBIOS = 'Guardar cambios';
/** TalkBack al guardar edición de nombre o cuenta. */
export const PISTA_GUARDAR_CAMBIOS = 'Guarda el nombre y la cuenta que elegiste';
export const ETIQUETA_CANCELAR = 'Cancelar';
export const ETIQUETA_NOMBRE = 'Nombre';
export const ETIQUETA_CUENTA_APORTACION = '¿De qué cuenta sale la aportación?';
export const ETIQUETA_CUENTA_PREGUNTAR = 'Pregúntame cada vez';
export const ERROR_NOMBRE_TANDA_VACIO = 'Escribe un nombre para la tanda.';
export const TEXTO_CONFIRMAR_ARCHIVAR =
  'Archivar quita la tanda de tu lista y cancela las aportaciones que faltaban. Lo que ya registraste se queda.';

const ESTADO_RONDA: Record<NonNullable<RondaTandaVista['estado']>, string> = {
  pendiente: 'Por dar',
  cubierta: 'Ya la diste',
  omitida: 'Ya la habías dado',
};

export function textoSubtituloTanda(aportacion: number, participantes: number, turno: number): string {
  return `${formatearCentavos(aportacion)} por ronda · ${participantes} participantes · tu turno: ${turno}`;
}

export function textoProximaAportacion(etiqueta: string): string {
  return `Próxima aportación: ${etiqueta}`;
}

export function textoCobras(cobro: number, etiquetaCobro: string): string {
  return `Cobras ${formatearCentavos(cobro)} el ${etiquetaCobro}.`;
}

export function textoDespuesRondaRiesgo(centavos: number): string {
  return `Después de esta ronda arriesgas ${formatearCentavos(centavos)}`;
}

export function textoLineaRonda(t: number, etiqueta: string, esCobro: boolean): string {
  return `${t}. ${etiqueta}${esCobro ? SUFIJO_TU_TURNO : ''}`;
}

export function etiquetaEstadoRonda(r: RondaTandaVista, archivada: boolean): string {
  if (!r.estado) return 'Más adelante';
  if (archivada && r.estado === 'omitida') return 'Cancelada';
  return ESTADO_RONDA[r.estado];
}

/** TalkBack: fila del calendario de rondas en el detalle (`02 §18`). */
export function etiquetaAccesibleRondaTanda(r: RondaTandaVista, archivada: boolean): string {
  const turno = r.esCobro ? ', tu turno' : '';
  const estado = etiquetaEstadoRonda(r, archivada);
  const riesgo = cifraEnPalabras(r.enRiesgo, 'centavos');
  return `Ronda ${r.t}, ${r.etiqueta}${turno}. ${estado}. Después de esta ronda arriesgas ${riesgo}`;
}

export const OPCIONES_FRECUENCIA_TANDA: readonly { valor: FrecuenciaTanda; etiqueta: string }[] = [
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'quincenal', etiqueta: 'Cada quincena (15 y último)' },
  { valor: 'catorcenal', etiqueta: 'Cada 14 días' },
  { valor: 'mensual', etiqueta: 'Cada mes' },
];

/** "No es ingreso, y lo dice" (`02 §18`). */
export const TEXTO_NO_ES_INGRESO = 'Esto es tu dinero de vuelta, no un ingreso.';

/** Lista de tandas vacía (`02 §18`). */
export const TEXTO_TANDAS_VACIO =
  'Agrega tu tanda y aparto cada aportación el día que toca.';

export function etiquetaVacioTandas(): string {
  return `${TITULO_TANDAS}. ${TEXTO_TANDAS_VACIO}`;
}

/** Lista vacía: el CTA «Nueva tanda» va justo debajo del copy (`02 §15`). */
export const PISTA_VACIO_TANDAS = 'Más abajo, botón Nueva tanda';

export const textoAportado = (centavos: number) => `Llevas ${formatearCentavos(centavos)} aportados`;
export const textoEnRiesgo = (centavos: number) =>
  `Si la tanda se cae, arriesgas ${formatearCentavos(centavos)}`;
export const textoPorAportar = (centavos: number) => `Te faltan ${formatearCentavos(centavos)} por aportar`;

/** "Llevas 6 aportaciones y ya cobraste: te faltan 4 ($2,000)" (E11-03). */
export function textoYaEmpezo(y: TandaYaEmpezada): string {
  const llevas =
    y.aportacionesHechas === 1 ? 'Llevas 1 aportación' : `Llevas ${y.aportacionesHechas} aportaciones`;
  const cobro = y.yaCobraste ? ' y ya cobraste' : '';
  return `${llevas}${cobro}: te faltan ${y.faltan} (${formatearCentavos(y.porAportar)})`;
}

export const mensajeAportacion = (m: MovimientoTanda) =>
  `Registré: diste tu tanda ${formatearCentavos(m.monto)} · ${m.cuenta}`;

export const mensajeCobro = (m: MovimientoTanda) =>
  `Registré: cobraste tu tanda ${formatearCentavos(m.monto)} · ${m.cuenta}. ${TEXTO_NO_ES_INGRESO}`;
