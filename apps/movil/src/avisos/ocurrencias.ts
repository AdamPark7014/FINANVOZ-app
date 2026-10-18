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
import { ordenDeSalida, yaPaso } from './tandas';

/**
 * Avisos locales de ocurrencias sin resolver (`02 §13`): "Compromiso sin cubrir" 1 día después de su fecha e
 * "Ingreso que no llegó" 3 días después de la fecha esperada, uno por ocurrencia, encendidos por defecto. Se dejan
 * programados desde ya y cada escritura los replanea: al cubrir, omitir o registrar el ingreso, la ocurrencia deja
 * de estar pendiente y su aviso se cancela. Sin concepto ni monto en el texto (regla 9). Planeación pura.
 */

/** Prefijos propios: las otras sincronizaciones no los tocan. */
export const PREFIJO_AVISO_COMPROMISO = 'compromiso:';
export const PREFIJO_AVISO_INGRESO = 'ingreso:';

/** `02 §13`: 1 día después de su fecha. */
export const DIAS_DESPUES_COMPROMISO = 1;
/** `02 §13`: 3 días después de la fecha esperada. */
export const DIAS_DESPUES_INGRESO = 3;

export const TITULO_AVISO_COMPROMISO = '¿Ya pagaste?';
export const CUERPO_AVISO_COMPROMISO =
  'Tienes un pago que ya venció y no lo has registrado. Abre Finanvoz para revisarlo.';
export const TITULO_AVISO_INGRESO = '¿Ya te pagaron?';
export const CUERPO_AVISO_INGRESO = 'No vi llegar un ingreso que esperabas. Abre Finanvoz para revisarlo.';

export interface OcurrenciaPendiente {
  readonly programadoId: string;
  readonly fecha: PlainDate;
}

export interface EntradaAvisosOcurrencias {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  /** Egresos pendientes (sin las aportaciones de tanda, que llevan su propio aviso). */
  readonly compromisos: readonly OcurrenciaPendiente[];
  /** Ocurrencias pendientes del ingreso que define el horizonte. */
  readonly ingresos: readonly OcurrenciaPendiente[];
  /** Interruptores de Ajustes › Avisos. */
  readonly avisarCompromiso: boolean;
  readonly avisarIngreso: boolean;
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
  readonly diasPlaneacion?: number;
}

/** Los avisos que todavía no salen dentro de la ventana de planeación, en orden de salida. */
export function planificarAvisosOcurrencias(e: EntradaAvisosOcurrencias): NotificacionLocal[] {
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const hora = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  const hasta = sumarDias(e.hoy, e.diasPlaneacion ?? DIAS_PLANEACION);
  const salida = new Map<string, NotificacionLocal>();
  const agregar = (
    lista: readonly OcurrenciaPendiente[],
    prefijo: string,
    diasDespues: number,
    titulo: string,
    cuerpo: string,
  ) => {
    for (const o of lista) {
      const id = `${prefijo}${o.programadoId}:${o.fecha}`;
      const m = fueraDeSilencio(sumarDias(o.fecha, diasDespues), hora, silencio);
      if (salida.has(id) || m.fecha > hasta || yaPaso(m.fecha, m.hora, e.hoy, e.horaActual)) continue;
      salida.set(id, { id, ...m, titulo, cuerpo });
    }
  };
  if (e.avisarCompromiso) {
    agregar(
      e.compromisos,
      PREFIJO_AVISO_COMPROMISO,
      DIAS_DESPUES_COMPROMISO,
      TITULO_AVISO_COMPROMISO,
      CUERPO_AVISO_COMPROMISO,
    );
  }
  if (e.avisarIngreso) {
    agregar(
      e.ingresos,
      PREFIJO_AVISO_INGRESO,
      DIAS_DESPUES_INGRESO,
      TITULO_AVISO_INGRESO,
      CUERPO_AVISO_INGRESO,
    );
  }
  return [...salida.values()].sort(ordenDeSalida);
}
