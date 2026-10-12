import type { PlainDate } from '@cartera/core';
import { fueraDeSilencio } from '../../avisos/planificar';
import type { NotificacionLocal } from '../../avisos/puerto';
import type { PreferenciasAvisos } from '../../servicios';

/** Prefijo propio: la sincronización de avisos de tarjetas (`tarjeta:`) no los toca. */
export const PREFIJO_RECORDATORIO_COMPRA = 'me-alcanza:';

/**
 * "Recuérdamelo el jueves" (`02 §9`): aviso local el día de "esperar", a la hora de tus avisos y fuera del
 * horario silencioso. Ni el id ni el texto llevan montos: la notificación se ve con el teléfono bloqueado.
 * Un recordatorio por fecha (uno nuevo para el mismo día reemplaza al anterior).
 */
export function avisoRecordatorio(
  fecha: PlainDate,
  descripcion: string | undefined,
  preferencias: Pick<PreferenciasAvisos, 'hora' | 'silencio'>,
): NotificacionLocal {
  const momento = fueraDeSilencio(fecha, preferencias.hora, preferencias.silencio);
  return {
    id: `${PREFIJO_RECORDATORIO_COMPRA}${fecha}`,
    fecha: momento.fecha,
    hora: momento.hora,
    titulo: '¿Te alcanza hoy?',
    cuerpo: descripcion
      ? `Hoy querías ver si te alcanza para ${descripcion}. Pregúntame de nuevo.`
      : 'Hoy querías ver si te alcanza para tu compra. Pregúntame de nuevo.',
  };
}
