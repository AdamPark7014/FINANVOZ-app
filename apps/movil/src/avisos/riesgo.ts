import { sumarDias, type PlainDate } from '@cartera/core';
import {
  fueraDeSilencio,
  HORA_AVISOS_POR_OMISION,
  HORARIO_SILENCIOSO_POR_OMISION,
  type HoraDelDia,
  type HorarioSilencioso,
} from './planificar';

/**
 * Aviso local "Riesgo de no llegar" (`02 §13`): P < 50 % al iniciar el día, 1 por horizonte, encendido por
 * defecto. La probabilidad solo se calcula con la app abierta, así que el aviso se deja programado para el
 * siguiente inicio de día (la hora de los avisos, fuera del horario silencioso) con la última probabilidad; cada
 * cálculo nuevo lo replanea y, si P ya no está bajo 50 %, lo cancela. Planeación pura: sin reloj ni I/O.
 */

/** Prefijo propio: la sincronización de tarjetas (`tarjeta:`) y los recordatorios (`me-alcanza:`) no lo tocan. */
export const PREFIJO_AVISO_RIESGO = 'riesgo:';

/** Umbral de `02 §13` sobre el porcentaje mostrado (E1.3). */
export const UMBRAL_RIESGO = 50;

/** El aviso que ya se programó en este horizonte (fecha y hora locales en que sale o salió). */
export interface AvisoRiesgoEnviado {
  readonly fin: PlainDate;
  readonly fecha: PlainDate;
  readonly hora: HoraDelDia;
}

export interface EntradaAvisoRiesgo {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  /** Porcentaje entero mostrado en Hoy (E1.3). */
  readonly porcentaje: number;
  /** Fecha del ingreso que cierra el horizonte (E3.3 `fin`). */
  readonly horizonteFin: PlainDate;
  /** "quincena". */
  readonly concepto: string;
  /** Interruptor de Ajustes → Avisos. */
  readonly activo: boolean;
  readonly enviado: AvisoRiesgoEnviado | null;
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
}

export interface AvisoRiesgo {
  /** `riesgo:<fin del horizonte>`: uno por horizonte. */
  readonly id: string;
  readonly tipo: 'riesgo';
  readonly referencia: PlainDate;
  readonly fecha: PlainDate;
  readonly hora: HoraDelDia;
  readonly titulo: string;
  readonly cuerpo: string;
}

/** `'HH:MM'` con ceros a la izquierda: el orden de texto es el orden del día. */
const yaPaso = (fecha: PlainDate, hora: HoraDelDia, hoy: PlainDate, ahora: HoraDelDia) =>
  fecha < hoy || (fecha === hoy && hora <= ahora);

/**
 * El aviso que debe quedar programado, o `null` (sin aviso: se cancela el pendiente). Sin montos ni porcentaje en
 * el texto: la notificación se ve con el teléfono bloqueado (regla 9).
 */
export function planificarAvisoRiesgo(e: EntradaAvisoRiesgo): AvisoRiesgo | null {
  if (!e.activo || e.porcentaje >= UMBRAL_RIESGO) return null;
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const preferida = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  let momento: { fecha: PlainDate; hora: HoraDelDia };
  if (e.enviado && e.enviado.fin === e.horizonteFin) {
    // Uno por horizonte: si ya salió, no se repite; si sigue pendiente, conserva su momento.
    if (yaPaso(e.enviado.fecha, e.enviado.hora, e.hoy, e.horaActual)) return null;
    momento = { fecha: e.enviado.fecha, hora: e.enviado.hora };
  } else {
    const hoyMismo = fueraDeSilencio(e.hoy, preferida, silencio);
    momento =
      hoyMismo.fecha === e.hoy && !yaPaso(hoyMismo.fecha, hoyMismo.hora, e.hoy, e.horaActual)
        ? hoyMismo
        : fueraDeSilencio(sumarDias(e.hoy, 1), preferida, silencio);
  }
  // El día del ingreso ya no es "antes de llegar": el horizonte se cierra.
  if (momento.fecha >= e.horizonteFin) return null;
  return {
    id: `${PREFIJO_AVISO_RIESGO}${e.horizonteFin}`,
    tipo: 'riesgo',
    referencia: e.horizonteFin,
    fecha: momento.fecha,
    hora: momento.hora,
    titulo: `Podrías no llegar a tu ${e.concepto}`,
    cuerpo: 'Con lo que sueles gastar, es probable que tengas que tocar tu colchón. Revisa qué viene.',
  };
}
