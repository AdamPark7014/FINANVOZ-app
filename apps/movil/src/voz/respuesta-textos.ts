import type { Centavos } from '@cartera/core';
import { cifraEnPalabras, etiquetaHablada } from '../ui/formato';

/**
 * Lo que Finanvoz dice en voz alta tras un dictado: el mismo mensaje del aviso, dicho como se oye
 * ("Nu terminación 4410", cifras en palabras), y cuánto puedes gastar hoy. Las cifras salen de `servicios/`.
 */
export function fraseRespuestaVoz(mensaje: string, hoyPuedes: Centavos | null): string {
  const limpio = etiquetaHablada(
    mensaje
      .replace(/••\s?(\d{4})/g, 'terminación $1')
      .replace(/\s·\s/g, ', ')
      .replace(/[«»]/g, '')
      .trim(),
  );
  if (hoyPuedes === null) return limpio;
  const cierre = /[.!?]$/.test(limpio) ? limpio : `${limpio}.`;
  return `${cierre} Hoy puedes gastar ${cifraEnPalabras(Math.max(0, hoyPuedes), 'pesos')}.`;
}
