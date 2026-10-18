import type { FrecuenciaTanda, MovimientoTanda, RondaTandaVista, TandaYaEmpezada } from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Copy de tandas (`02 §18`, tuteo). */

/** Detalle (`tandas/[id]`). */
export const ETIQUETA_VOLVER = 'Volver';
export const TEXTO_TANDA_NO_ENCONTRADA = 'No encontré esa tanda.';
export const TEXTO_TANDA_ARCHIVADA = 'Archivada · ya no aparto aportaciones';
export const ETIQUETA_YA_LA_DI = 'Ya la di';
export const ETIQUETA_ME_TOCO = 'Me tocó la tanda';
export const TITULO_CALENDARIO = 'Calendario';
export const SUFIJO_TU_TURNO = ' · tu turno';
export const ETIQUETA_EDITAR_NOMBRE_CUENTA = 'Editar nombre o cuenta';
export const ETIQUETA_ARCHIVAR_TANDA = 'Archivar tanda';
export const ETIQUETA_GUARDAR_CAMBIOS = 'Guardar cambios';
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
