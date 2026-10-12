import type { NotificacionCruda, Sha256Hex } from './tipos';

/** `cuando` = `notification.when` si es mayor que 0; si no, `postTime` (`07 §2.4`). */
export function cuandoEfectivo(n: Pick<NotificacionCruda, 'cuando' | 'publicada_en'>): number {
  return n.cuando > 0 ? n.cuando : n.publicada_en;
}

/**
 * Huella de idempotencia (`07 §2.4`): `SHA-256(paquete | clave | cuando | titulo | texto)` en hexadecimal. La
 * misma notificación leída dos veces da la misma huella; dos compras idénticas con `cuando` distinto, no.
 * Se calcula sobre el paquete que reportó el sistema (antes del mapeo de depuración por etiqueta).
 */
export async function calcularHuella(n: NotificacionCruda, sha256: Sha256Hex): Promise<string> {
  const partes = [n.paquete, n.clave, String(cuandoEfectivo(n)), n.titulo ?? '', n.texto ?? ''];
  const hex = (await sha256(partes.join('|'))).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('huella inválida');
  return hex;
}
