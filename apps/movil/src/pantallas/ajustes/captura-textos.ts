import type { ModoAvisoCaptura } from '../../servicios';
import type { OpcionChip } from '../principal/Chip';

/** Redacción Ajustes › Captura (`02 §12`, `08 §3.1`): tuteo; el conteo de apps viene de `servicios/`. */

export const SECCION_CAPTURA = 'Captura automática';

export const ETIQUETA_AVISO_AL_CAPTURAR = 'Aviso al capturar';
export const DESC_AVISO_AL_CAPTURAR =
  'Te aviso en segundo plano cuando anoto un movimiento. Nunca lleva montos ni comercios.';
export const PREGUNTA_MODO_AVISO = '¿Cómo quieres el aviso al capturar?';

export const OPCIONES_MODO_AVISO: readonly OpcionChip<ModoAvisoCaptura>[] = [
  { valor: 'agrupados', etiqueta: 'Agrupados' },
  { valor: 'cada_uno', etiqueta: 'Cada uno' },
  { valor: 'nunca', etiqueta: 'Nunca' },
];

export const BTN_DESACTIVAR_CAPTURA = 'Desactivar';
export const BTN_ACTIVAR_CAPTURA = 'Activar';

export const ESTADO_APAGADA = 'Apagada.';
export const ESTADO_NO_DISPONIBLE = 'No disponible en este teléfono.';

export function textoCapturaActiva(cantidadApps: number): string {
  return cantidadApps === 1
    ? 'Activa: leo los avisos de 1 app de banco.'
    : `Activa: leo los avisos de ${cantidadApps} apps de banco.`;
}
