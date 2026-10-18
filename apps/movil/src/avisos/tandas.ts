import { sumarDias, type PlainDate } from '@cartera/core';
import {
  DIAS_PLANEACION,
  fueraDeSilencio,
  HORA_AVISOS_POR_OMISION,
  HORARIO_SILENCIOSO_POR_OMISION,
  type HoraDelDia,
  type HorarioSilencioso,
} from './planificar';
import type { NotificacionLocal } from './puerto';

/**
 * Aviso local "Aportación de tanda" (`02 §13`, M8): el día de cada aportación pendiente, uno por ronda, a la hora
 * de tus avisos y fuera del horario silencioso, encendido por defecto. Ni el texto lleva el nombre de la tanda ni
 * el monto: la notificación se ve con el teléfono bloqueado (regla 9); el id solo lleva el id de la tanda para
 * abrir su detalle. Planeación pura: sin reloj ni I/O.
 */

/** Prefijo propio: las otras sincronizaciones (`tarjeta:`, `cobro:`, `riesgo:`, …) no lo tocan. */
export const PREFIJO_AVISO_TANDA = 'tanda:';

export const TITULO_AVISO_TANDA = 'Hoy toca tu tanda';
export const CUERPO_AVISO_TANDA = 'Hoy te toca dar tu aportación. Abre Finanvoz para registrarla.';

export interface AportacionPendiente {
  readonly tandaId: string;
  /** Fecha de la ronda (la de su ocurrencia pendiente). */
  readonly fecha: PlainDate;
}

export interface EntradaAvisosTanda {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  readonly aportaciones: readonly AportacionPendiente[];
  /** Interruptor de Ajustes › Avisos. */
  readonly activo: boolean;
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
  readonly diasPlaneacion?: number;
}

/** `'HH:MM'` con ceros a la izquierda: el orden de texto es el orden del día. */
export const yaPaso = (fecha: PlainDate, hora: HoraDelDia, hoy: PlainDate, ahora: HoraDelDia) =>
  fecha < hoy || (fecha === hoy && hora <= ahora);

/** Orden de salida: fecha, hora e id. */
export function ordenDeSalida(a: NotificacionLocal, b: NotificacionLocal): number {
  return (
    (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
    (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Los avisos de aportación que todavía no salen dentro de la ventana de planeación, en orden de salida. */
export function planificarAvisosTanda(e: EntradaAvisosTanda): NotificacionLocal[] {
  if (!e.activo) return [];
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const hora = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  const hasta = sumarDias(e.hoy, e.diasPlaneacion ?? DIAS_PLANEACION);
  const salida = new Map<string, NotificacionLocal>();
  for (const a of e.aportaciones) {
    const id = `${PREFIJO_AVISO_TANDA}${a.tandaId}:${a.fecha}`;
    const m = fueraDeSilencio(a.fecha, hora, silencio);
    if (salida.has(id) || m.fecha > hasta || yaPaso(m.fecha, m.hora, e.hoy, e.horaActual)) continue;
    salida.set(id, { id, ...m, titulo: TITULO_AVISO_TANDA, cuerpo: CUERPO_AVISO_TANDA });
  }
  return [...salida.values()].sort(ordenDeSalida);
}
