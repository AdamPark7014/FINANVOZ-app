import { diferenciaDias, sumarDias, type PlainDate } from '@cartera/core';
import {
  DIAS_PLANEACION,
  fueraDeSilencio,
  HORA_AVISOS_POR_OMISION,
  HORARIO_SILENCIOSO_POR_OMISION,
  type HoraDelDia,
  type HorarioSilencioso,
} from './planificar';

/**
 * Aviso local "Respaldo pendiente" (`02 §13`, RF-RES-04, CA-M9-06): a los 14 días sin respaldo y después uno por
 * semana mientras siga sin respaldo, encendido por defecto y fuera del horario silencioso. Se deja programado
 * desde ya (la app puede no abrirse en esos días); cada respaldo nuevo lo replanea. Planeación pura: sin reloj
 * ni I/O.
 */

/** Prefijo propio: las otras sincronizaciones (`tarjeta:`, `riesgo:`, `cobro:`) no lo tocan. */
export const PREFIJO_AVISO_RESPALDO = 'respaldo:';
/** `02 §13`: 14 días sin respaldo. */
export const DIAS_SIN_RESPALDO = 14;
/** `02 §13`: tope de 1 por semana. */
export const DIAS_ENTRE_AVISOS_RESPALDO = 7;
/** Cuántos avisos semanales quedan programados por adelantado. */
export const AVISOS_RESPALDO_ADELANTADOS = 4;

export interface EntradaAvisoRespaldo {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  /** Fecha del último respaldo; si nunca hubo, la fecha en que terminó el onboarding. `null`: sin aviso. */
  readonly desde: PlainDate | null;
  /** Interruptor de Ajustes → Avisos. */
  readonly activo: boolean;
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
}

export interface AvisoRespaldo {
  /** `respaldo:<fecha en que sale>`. */
  readonly id: string;
  readonly tipo: 'respaldo';
  readonly fecha: PlainDate;
  readonly hora: HoraDelDia;
  readonly titulo: string;
  readonly cuerpo: string;
}

export const TITULO_AVISO_RESPALDO = 'Respalda tus datos';
export const CUERPO_AVISO_RESPALDO =
  'Llevas más de 2 semanas sin respaldo. Respalda ahora en Ajustes para no perder nada si cambias de teléfono.';

const yaPaso = (fecha: PlainDate, hora: HoraDelDia, hoy: PlainDate, ahora: HoraDelDia) =>
  fecha < hoy || (fecha === hoy && hora <= ahora);

/** ¿Ya pasaron 14 días sin respaldo? (Ajustes → Respaldo lo dice también en la pantalla.) */
export function respaldoPendiente(desde: PlainDate | null, hoy: PlainDate): boolean {
  return desde !== null && diferenciaDias(desde, hoy) >= DIAS_SIN_RESPALDO;
}

/**
 * Avisos que deben quedar programados: el día 14 después de `desde` y cada 7 días, solo los que todavía no
 * salen, hasta `AVISOS_RESPALDO_ADELANTADOS` dentro de la ventana de planeación. Sin datos en el texto.
 */
export function planificarAvisosRespaldo(e: EntradaAvisoRespaldo): AvisoRespaldo[] {
  if (!e.activo || e.desde === null) return [];
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const preferida = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  const hasta = sumarDias(e.hoy, DIAS_PLANEACION);
  const salida: AvisoRespaldo[] = [];
  // Primer aviso de la serie que todavía puede salir (los anteriores ya salieron o se perdieron).
  const atraso = diferenciaDias(sumarDias(e.desde, DIAS_SIN_RESPALDO), e.hoy);
  let k = atraso > 0 ? Math.floor(atraso / DIAS_ENTRE_AVISOS_RESPALDO) : 0;
  for (; salida.length < AVISOS_RESPALDO_ADELANTADOS; k++) {
    const dia = sumarDias(e.desde, DIAS_SIN_RESPALDO + k * DIAS_ENTRE_AVISOS_RESPALDO);
    const m = fueraDeSilencio(dia, preferida, silencio);
    if (m.fecha > hasta) break;
    if (yaPaso(m.fecha, m.hora, e.hoy, e.horaActual)) continue;
    salida.push({
      id: `${PREFIJO_AVISO_RESPALDO}${dia}`,
      tipo: 'respaldo',
      fecha: m.fecha,
      hora: m.hora,
      titulo: TITULO_AVISO_RESPALDO,
      cuerpo: CUERPO_AVISO_RESPALDO,
    });
  }
  return salida;
}
