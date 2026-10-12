import {
  corteDe,
  limiteDe,
  siguienteCorte,
  sumarDias,
  type Centavos,
  type PlainDate,
  type TarjetaCredito,
} from '@cartera/core';
import { etiquetaFecha } from '../servicios/formato';
import { formatearCentavos } from '../ui/formato';

/**
 * Planeación pura de los avisos locales de tarjetas (`02 §13`, RF-TAR-05, CA-M4-04): "Día de corte" el día del
 * corte y "Fecha límite de pago" 3 días antes, con el PNGI, uno por tarjeta y periodo, respetando el horario
 * silencioso. Sin reloj ni I/O: recibe la fecha y la hora actuales; el puerto (`puerto.ts`) los programa.
 */

/** `'HH:MM'` en 24 h, hora local del teléfono. */
export type HoraDelDia = string;

export interface HorarioSilencioso {
  readonly inicio: HoraDelDia;
  readonly fin: HoraDelDia;
}

/** `02 §13`: 22:00–08:00 (configurable). */
export const HORARIO_SILENCIOSO_POR_OMISION: HorarioSilencioso = { inicio: '22:00', fin: '08:00' };
/** Hora a la que sale un aviso del día si nada lo impide. */
export const HORA_AVISOS_POR_OMISION: HoraDelDia = '09:00';
/** La fecha límite se avisa 3 días antes (RF-TAR-05). */
export const DIAS_ANTES_FECHA_LIMITE = 3;
/** Cuántos días hacia adelante se dejan programados (se replanea al abrir la app). */
export const DIAS_PLANEACION = 62;

export interface TarjetaParaAvisos {
  readonly id: string;
  readonly nombre: string;
  readonly ciclo: TarjetaCredito;
  /**
   * PNGI de cada corte ya cerrado (E5.3). Si un corte no está, su PNGI aún no se conoce (el corte no ha
   * cerrado) y el aviso sale sin monto; con PNGI 0 (ya pagaste) no se avisa la fecha límite.
   */
  readonly pngiPorCorte: Readonly<Record<PlainDate, Centavos>>;
}

export interface EntradaPlanAvisos {
  readonly hoy: PlainDate;
  readonly horaActual: HoraDelDia;
  readonly tarjetas: readonly TarjetaParaAvisos[];
  readonly silencio?: HorarioSilencioso;
  readonly horaPreferida?: HoraDelDia;
  readonly avisarCorte?: boolean;
  readonly avisarLimite?: boolean;
  readonly diasPlaneacion?: number;
}

export type TipoAviso = 'corte' | 'fecha_limite';

export interface AvisoPlaneado {
  /** Determinista: `tarjeta:<tipo>:<tarjeta>:<fecha del corte o límite>` (1 por tarjeta y periodo). */
  readonly id: string;
  readonly tipo: TipoAviso;
  readonly tarjetaId: string;
  /** Corte o fecha límite a la que se refiere el aviso. */
  readonly referencia: PlainDate;
  /** Cuándo sale (fecha y hora locales, ya fuera del horario silencioso). */
  readonly fecha: PlainDate;
  readonly hora: HoraDelDia;
  readonly titulo: string;
  readonly cuerpo: string;
}

export const PREFIJO_AVISOS_TARJETA = 'tarjeta:';

function minutos(h: HoraDelDia): number {
  const m = /^(\d{2}):(\d{2})$/.exec(h);
  const hh = Number(m?.[1]);
  const mm = Number(m?.[2]);
  if (!m || hh > 23 || mm > 59) throw new RangeError('hora inválida');
  return hh * 60 + mm;
}

/** ¿`hora` cae dentro del horario silencioso? (un horario que cruza la medianoche, como 22:00–08:00, incluido). */
export function enSilencio(hora: HoraDelDia, s: HorarioSilencioso): boolean {
  const h = minutos(hora);
  const i = minutos(s.inicio);
  const f = minutos(s.fin);
  if (i === f) return false;
  return i < f ? h >= i && h < f : h >= i || h < f;
}

/**
 * Si el instante cae en el horario silencioso, lo mueve al final del silencio (el mismo día si es de madrugada,
 * el siguiente si es de noche). Fuera del silencio no cambia.
 */
export function fueraDeSilencio(
  fecha: PlainDate,
  hora: HoraDelDia,
  s: HorarioSilencioso,
): { fecha: PlainDate; hora: HoraDelDia } {
  if (!enSilencio(hora, s)) return { fecha, hora };
  const cruza = minutos(s.inicio) > minutos(s.fin);
  const despuesDeInicio = minutos(hora) >= minutos(s.inicio);
  return { fecha: cruza && despuesDeInicio ? sumarDias(fecha, 1) : fecha, hora: s.fin };
}

function futuro(fecha: PlainDate, hora: HoraDelDia, hoy: PlainDate, ahora: HoraDelDia): boolean {
  return fecha > hoy || (fecha === hoy && minutos(hora) > minutos(ahora));
}

/**
 * Avisos de corte y fecha límite de las tarjetas para los próximos `diasPlaneacion` días, en orden de salida.
 * Solo los que todavía no salen; un aviso de fecha límite cuyo momento ya pasó no se reprograma (Hoy muestra la
 * tarjeta de acción "Pago de tarjeta que vence").
 */
export function planificarAvisosTarjetas(e: EntradaPlanAvisos): AvisoPlaneado[] {
  const silencio = e.silencio ?? HORARIO_SILENCIOSO_POR_OMISION;
  const hora = e.horaPreferida ?? HORA_AVISOS_POR_OMISION;
  const hasta = sumarDias(e.hoy, e.diasPlaneacion ?? DIAS_PLANEACION);
  minutos(e.horaActual);
  const salida: AvisoPlaneado[] = [];
  for (const t of e.tarjetas) {
    // Desde el corte cuya fecha límite todavía puede avisarse.
    let corte = corteDe(t.ciclo, sumarDias(e.hoy, -62));
    for (; corte <= hasta; corte = siguienteCorte(t.ciclo, corte)) {
      if (e.avisarCorte !== false) {
        const m = fueraDeSilencio(corte, hora, silencio);
        if (futuro(m.fecha, m.hora, e.hoy, e.horaActual) && m.fecha <= hasta) {
          salida.push({
            id: `${PREFIJO_AVISOS_TARJETA}corte:${t.id}:${corte}`,
            tipo: 'corte',
            tarjetaId: t.id,
            referencia: corte,
            ...m,
            titulo: `Hoy es el corte de tu ${t.nombre}`,
            cuerpo: 'Lo que compres desde mañana entra en tu siguiente periodo.',
          });
        }
      }
      if (e.avisarLimite !== false) {
        const limite = limiteDe(t.ciclo, corte);
        const pngi = t.pngiPorCorte[corte];
        if (pngi === 0) continue; // ya no hay nada que pagar de ese periodo
        const m = fueraDeSilencio(sumarDias(limite, -DIAS_ANTES_FECHA_LIMITE), hora, silencio);
        if (futuro(m.fecha, m.hora, e.hoy, e.horaActual) && m.fecha <= hasta) {
          salida.push({
            id: `${PREFIJO_AVISOS_TARJETA}limite:${t.id}:${limite}`,
            tipo: 'fecha_limite',
            tarjetaId: t.id,
            referencia: limite,
            ...m,
            titulo: `Tu ${t.nombre} vence el ${etiquetaFecha(limite)}`,
            cuerpo:
              pngi === undefined
                ? 'Revisa cuánto pagar para no generar intereses.'
                : `Paga ${formatearCentavos(pngi)} para no generar intereses.`,
          });
        }
      }
    }
  }
  return salida.sort(
    (a, b) =>
      (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
      minutos(a.hora) - minutos(b.hora) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
