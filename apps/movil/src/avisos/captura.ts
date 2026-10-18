/**
 * Aviso local al capturar movimientos en segundo plano (`02 §6`, `07 §2.4`): silencioso, agrupable cada 30 min.
 * Sin montos ni comercios (regla 9). Planeación del texto; la publicación vive en `captura/aviso-capturas.ts`.
 */

export const PREFIJO_AVISO_CAPTURA = 'captura:';

export const TITULO_AVISO_CAPTURA = 'Movimientos nuevos';

export const RUTA_AVISO_CAPTURA = '/movimientos';

/** Cuerpo de la notificación; nunca lleva monto ni comercio. */
export function textoAvisoCaptura(cantidad: number): string {
  if (cantidad <= 0) return '';
  if (cantidad === 1) return '1 movimiento nuevo. Revísalo en Movimientos.';
  return `${cantidad} movimientos nuevos. Revísalos en Movimientos.`;
}
