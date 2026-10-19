import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui/formato';

/** Redacción Ajustes › Colchón (`02 §12`, RF-CFG-02): tuteo; montos vienen de `servicios/` y `ui/`. */

export const SECCION_COLCHON = 'Colchón';

export const ETIQUETA_MONTO_COLCHON = 'Tu colchón';
export const BTN_GUARDAR = 'Guardar';
/** TalkBack al guardar el colchón en Ajustes (`02 §12`). */
export const PISTA_GUARDAR_COLCHON = 'Guarda cuánto apartas que no cuenta para lo que puedes gastar';
export const BTN_CANCELAR = 'Cancelar';

export const BTN_CAMBIAR_COLCHON = 'Cambiar mi colchón';
export const BTN_APARTAR_COLCHON = 'Apartar un colchón';
export const PISTA_CAMBIAR_COLCHON = 'Abre el campo para cambiar cuánto apartas';
export const PISTA_APARTAR_COLCHON =
  'Abre el campo para apartar dinero que no cuenta para lo que puedes gastar';

export const AYUDA_SIN_SUGERENCIA = 'Escribe 0 si no quieres colchón.';

/** O7 y Ajustes › Colchón: sugerencia del 10 % del ingreso del periodo. */
export function sugerenciaMontoColchon10(sugerido: Centavos): string {
  return `Te sugerimos ${formatearCentavos(sugerido)}: el 10 % de lo que te pagan.`;
}

export function ayudaColchon(sugerido: Centavos): string {
  return `${sugerenciaMontoColchon10(sugerido)} Escribe 0 si no quieres colchón.`;
}

export function resumenConColchon(monto: Centavos): string {
  return `Apartas ${formatearCentavos(monto)} que no cuentan para lo que puedes gastar.`;
}

export const RESUMEN_SIN_COLCHON = 'Sin colchón: todo tu dinero libre cuenta para lo que puedes gastar.';

export function confirmacionColchon(monto: Centavos): string {
  return `Listo: tu colchón ahora es ${formatearCentavos(monto)}.`;
}

export const CONFIRMACION_SIN_COLCHON = 'Listo: ya no apartas colchón.';
