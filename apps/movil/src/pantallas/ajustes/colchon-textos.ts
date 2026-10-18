import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

/** Redacción Ajustes › Colchón (`02 §12`, RF-CFG-02): tuteo; montos vienen de `servicios/` y `ui/`. */

export const SECCION_COLCHON = 'Colchón';

export const ETIQUETA_MONTO_COLCHON = 'Tu colchón';
export const BTN_GUARDAR = 'Guardar';
export const BTN_CANCELAR = 'Cancelar';

export const BTN_CAMBIAR_COLCHON = 'Cambiar mi colchón';
export const BTN_APARTAR_COLCHON = 'Apartar un colchón';

export const AYUDA_SIN_SUGERENCIA = 'Escribe 0 si no quieres colchón.';

export function ayudaColchon(sugerido: Centavos): string {
  return `Te sugerimos ${formatearCentavos(sugerido)}: el 10 % de lo que te pagan. Escribe 0 si no quieres colchón.`;
}

export function resumenConColchon(monto: Centavos): string {
  return `Apartas ${formatearCentavos(monto)} que no cuentan para lo que puedes gastar.`;
}

export const RESUMEN_SIN_COLCHON =
  'Sin colchón: todo tu dinero libre cuenta para lo que puedes gastar.';

export function confirmacionColchon(monto: Centavos): string {
  return `Listo: tu colchón ahora es ${formatearCentavos(monto)}.`;
}

export const CONFIRMACION_SIN_COLCHON = 'Listo: ya no apartas colchón.';
