import type { PlainDate } from '@cartera/core';
import {
  fueraDeSilencio,
  HORA_AVISOS_POR_OMISION,
  HORARIO_SILENCIOSO_POR_OMISION,
  type HoraDelDia,
  type HorarioSilencioso,
} from './planificar';
import type { NotificacionLocal } from './puerto';

/**
 * Recordatorios de cobro (`02 §17`, RF-PER-03): un aviso local por persona que te debe, el día que elegiste, a la
 * hora de tus avisos y fuera del horario silencioso. Ni el id ni el texto llevan nombres ni montos: la
 * notificación se ve con el teléfono bloqueado (regla 9). Planeación pura: sin reloj ni I/O.
 */

/** Prefijo propio: las sincronizaciones de tarjetas (`tarjeta:`), riesgo y "¿Me alcanza?" no lo tocan. */
export const PREFIJO_RECORDATORIO_COBRO = 'cobro:';

export const TITULO_RECORDATORIO_COBRO = 'Recordatorio de cobro';
export const CUERPO_RECORDATORIO_COBRO =
  'Hoy querías cobrar lo que te deben. Abre Finanvoz para mandar el mensaje.';

export interface RecordatorioCobroGuardado {
  /** Cuenta `contraparte:persona`. */
  readonly personaId: string;
  readonly fecha: PlainDate;
  /** Lo que te debe hoy; con 0 o menos ya no se avisa. */
  readonly saldo: number;
}

export interface EntradaRecordatoriosCobro {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  readonly recordatorios: readonly RecordatorioCobroGuardado[];
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
}

/** Los avisos que todavía no salen, de personas que aún te deben, en orden de salida. */
export function planificarRecordatoriosCobro(e: EntradaRecordatoriosCobro): NotificacionLocal[] {
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const hora = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  const salida: NotificacionLocal[] = [];
  for (const r of e.recordatorios) {
    if (r.saldo <= 0) continue;
    const m = fueraDeSilencio(r.fecha, hora, silencio);
    const pasado = m.fecha < e.hoy || (m.fecha === e.hoy && m.hora <= e.horaActual);
    if (pasado) continue;
    salida.push({
      id: `${PREFIJO_RECORDATORIO_COBRO}${r.personaId}`,
      fecha: m.fecha,
      hora: m.hora,
      titulo: TITULO_RECORDATORIO_COBRO,
      cuerpo: CUERPO_RECORDATORIO_COBRO,
    });
  }
  return salida.sort(
    (a, b) =>
      (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
      (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
