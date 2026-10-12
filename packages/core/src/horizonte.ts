import { VENTANA_INGRESO_DESPUES } from './cobertura';
import { exigirCentavos, type Centavos } from './dinero';
import { ErrorDominio } from './errores';
import { diferenciaDias, partes, sumarDias, type PlainDate } from './fecha';
import { fechasEfectivas, proximasFechas, type Regla } from './recurrencia';

/** Horizonte fijo del modo ingreso variable y del espacio negocio (E3.3, E4). */
export const DIAS_HORIZONTE_FIJO = 30;

export type EstadoHorizonte = 'normal' | 'dia_de_pago' | 'retrasado' | 'ingreso_variable';

export interface Horizonte {
  fin: PlainDate;
  fin_efectivo: PlainDate;
  dias: number;
  estado: EstadoHorizonte;
}

/**
 * E3.3: el horizonte termina en el próximo ingreso que todavía no llega.
 * `regla = null` → modo ingreso variable (30 días, el ingreso no se proyecta).
 * `recibidas`: fechas de ocurrencias de ingreso ya cubiertas (E3.5).
 */
export function horizonte(hoy: PlainDate, regla: Regla | null, recibidas: readonly PlainDate[]): Horizonte {
  partes(hoy);
  if (regla === null) {
    const fin = sumarDias(hoy, DIAS_HORIZONTE_FIJO);
    return { fin, fin_efectivo: fin, dias: DIAS_HORIZONTE_FIJO, estado: 'ingreso_variable' };
  }
  const cubiertas = new Set(recibidas);
  const fin = proximasFechas(regla, sumarDias(hoy, -VENTANA_INGRESO_DESPUES), 6).find(
    (f) => !cubiertas.has(f),
  );
  if (fin === undefined) {
    // Seis ocurrencias seguidas cubiertas (o una regla única ya pasada): no hay próximo ingreso
    // conocido. Se usa el horizonte fijo, que nunca proyecta un ingreso (regla 12).
    const finFijo = sumarDias(hoy, DIAS_HORIZONTE_FIJO);
    return { fin: finFijo, fin_efectivo: finFijo, dias: DIAS_HORIZONTE_FIJO, estado: 'ingreso_variable' };
  }
  const estado: EstadoHorizonte = fin > hoy ? 'normal' : fin === hoy ? 'dia_de_pago' : 'retrasado';
  const finEfectivo = estado === 'normal' ? fin : sumarDias(fin, VENTANA_INGRESO_DESPUES + 1);
  return { fin, fin_efectivo: finEfectivo, dias: diferenciaDias(hoy, finEfectivo), estado };
}

/** Egreso (o ingreso) programado con su regla de recurrencia. */
export interface Programado {
  concepto: string;
  monto: Centavos;
  regla: Regla;
}

export interface Ocurrencia {
  concepto: string;
  fecha: PlainDate;
  monto: Centavos;
}

/**
 * E3.4: instancias con fecha efectiva en `[desde, hasta)`. Las nominales se generan en
 * `[desde − 7, hasta + 7]` antes de ajustar. Orden: fecha, concepto.
 */
export function expandirProgramados(
  programados: readonly Programado[],
  desde: PlainDate,
  hasta: PlainDate,
): Ocurrencia[] {
  if (hasta < desde) throw new ErrorDominio('intervalo_invalido', 'hasta < desde');
  const salida: Ocurrencia[] = [];
  for (const p of programados) {
    exigirCentavos(p.monto, 'monto');
    for (const fecha of fechasEfectivas(p.regla, sumarDias(desde, -7), sumarDias(hasta, 7))) {
      if (fecha >= desde && fecha < hasta) salida.push({ concepto: p.concepto, fecha, monto: p.monto });
    }
  }
  return salida.sort((a, b) =>
    a.fecha !== b.fecha
      ? a.fecha < b.fecha
        ? -1
        : 1
      : a.concepto < b.concepto
        ? -1
        : a.concepto > b.concepto
          ? 1
          : 0,
  );
}
