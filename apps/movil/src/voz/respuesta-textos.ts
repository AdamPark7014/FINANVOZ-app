import type { Centavos } from '@cartera/core';
import { limpiarParaVoz } from '../servicios/voz-respuesta';
import { cifraEnPalabras } from '../ui/formato';

/**
 * Lo que Finanvoz dice en voz alta tras un dictado: el mismo mensaje del aviso, dicho como se oye (sin
 * terminaciones de tarjeta ni símbolos, cifras en palabras), y cuánto puedes gastar hoy. Las cifras salen de
 * `servicios/`.
 *
 * @deprecated En el asistente usa `fraseHablada(turno)` (`servicios/voz-respuesta`) o `decirTurno`: frases cortas y
 * cálidas en vez del texto de la pantalla.
 */
export function fraseRespuestaVoz(mensaje: string, hoyPuedes: Centavos | null): string {
  const limpio = limpiarParaVoz(mensaje);
  if (hoyPuedes === null) return limpio;
  const cierre = /[.?…]$/.test(limpio) ? limpio : `${limpio}.`;
  return `${cierre} Hoy puedes gastar ${cifraEnPalabras(Math.max(0, hoyPuedes), 'pesos')}.`;
}
