import type { Apariencia } from '../../servicios/apariencia';

/** Redacción de Ajustes › Apariencia (`02 §12`, `02 §14`, `02 §16`): tuteo, sin tecnicismos. */

export const SECCION_APARIENCIA = 'Apariencia';

export const ETIQUETAS_APARIENCIA: Readonly<Record<Apariencia, string>> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Como el teléfono',
};

export const PREGUNTA_APARIENCIA = '¿Cómo quieres ver Finanvoz?';
export const DESC_APARIENCIA_SISTEMA =
  'Con «Como el teléfono», Finanvoz se ve oscuro cuando tu teléfono lo está.';

/** Acción que lee el lector de pantalla al final de la fila (título, valor actual y acción). */
export const BTN_CAMBIAR_APARIENCIA = 'Cambiar la apariencia';
export const PISTA_CAMBIAR_APARIENCIA = 'Abre las opciones: claro, oscuro o como el teléfono';

export const BTN_LISTO_APARIENCIA = 'Listo';
export const PISTA_LISTO_APARIENCIA = 'Cierra las opciones de apariencia';
