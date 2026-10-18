import type { ModoAvisoCaptura } from '../../servicios';
import { enteroEnPalabras } from '../../ui/formato';
import type { OpcionChip } from '../principal/Chip';

/** Redacción Ajustes › Captura (`02 §12`, `08 §3.1`): tuteo; el conteo de apps viene de `servicios/`. */

export const SECCION_CAPTURA = 'Captura automática';

export const ETIQUETA_AVISO_AL_CAPTURAR = 'Aviso al capturar';
export const DESC_AVISO_AL_CAPTURAR =
  'Te aviso en segundo plano cuando anoto un movimiento. Nunca lleva montos ni comercios.';
/** TalkBack: título y explicación en un solo foco (visible: título + {@link DESC_AVISO_AL_CAPTURAR}). */
export const ETIQUETA_BLOQUE_AVISO_CAPTURAR = `${ETIQUETA_AVISO_AL_CAPTURAR}. ${DESC_AVISO_AL_CAPTURAR}`;
export const PREGUNTA_MODO_AVISO = '¿Cómo quieres el aviso al capturar?';

export const OPCIONES_MODO_AVISO: readonly OpcionChip<ModoAvisoCaptura>[] = [
  { valor: 'agrupados', etiqueta: 'Agrupados' },
  { valor: 'cada_uno', etiqueta: 'Cada uno' },
  { valor: 'nunca', etiqueta: 'Nunca' },
];

export const BTN_DESACTIVAR_CAPTURA = 'Desactivar';
export const PISTA_DESACTIVAR_CAPTURA =
  'Deja de leer avisos de banco; la lista blanca se vacía en tu teléfono';
export const BTN_ACTIVAR_CAPTURA = 'Activar';
export const PISTA_ACTIVAR_CAPTURA = 'Activa la lectura de notificaciones de las apps que elijas';

export const ESTADO_APAGADA = 'Apagada.';
export const ESTADO_NO_DISPONIBLE = 'No disponible en este teléfono.';

/** TalkBack cuando la captura está apagada (visible: {@link ESTADO_APAGADA}). */
export const ETIQUETA_CAPTURA_APAGADA = 'Captura automática apagada';
/** TalkBack sin módulo nativo (visible: {@link ESTADO_NO_DISPONIBLE}). */
export const ETIQUETA_CAPTURA_NO_DISPONIBLE =
  'Captura automática no disponible en este teléfono';

const SIN_APPS_EN_LISTA = 'Activa: aún no hay apps de banco en la lista.';

export function textoCapturaActiva(cantidadApps: number): string {
  if (cantidadApps === 0) return SIN_APPS_EN_LISTA;
  return cantidadApps === 1
    ? 'Activa: leo los avisos de 1 app de banco.'
    : `Activa: leo los avisos de ${cantidadApps} apps de banco.`;
}

/** TalkBack: el conteo de apps en palabras (`02 §15`). */
export function etiquetaCapturaActiva(cantidadApps: number): string {
  if (cantidadApps === 0) return SIN_APPS_EN_LISTA;
  const apps =
    cantidadApps === 1
      ? 'una app de banco'
      : `${enteroEnPalabras(cantidadApps)} apps de banco`;
  return `Activa: leo los avisos de ${apps}.`;
}
