/**
 * Fechas relativas del nivel 0 (docs/06-NLU.md §3.1 Fechas y Rangos de consulta). Toda la aritmética es civil
 * (`core/fecha`); la fecha de hoy viene en el contexto, nunca del reloj.
 */
import { conDia, diaSemana, diasDelMes, partes, sumarDias, type DiaSemana } from '@cartera/core';
import type { Lector } from './lector';
import { leerEntero } from './montos';

const DIAS: Readonly<Record<string, DiaSemana>> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

export const MESES: Readonly<Record<string, number>> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export interface Rango {
  desde: string;
  hasta: string;
}

/** Ocurrencia pasada más reciente de un día de la semana, sin contar hoy. */
function diaPasado(hoy: string, dia: DiaSemana): string {
  const diferencia = (diaSemana(hoy) - dia + 7) % 7;
  return sumarDias(hoy, -(diferencia === 0 ? 7 : diferencia));
}

/** Próxima ocurrencia de un día de la semana, sin contar hoy. */
function diaProximo(hoy: string, dia: DiaSemana): string {
  const diferencia = (dia - diaSemana(hoy) + 7) % 7;
  return sumarDias(hoy, diferencia === 0 ? 7 : diferencia);
}

/** Fecha más reciente ≤ hoy con ese día del mes (si el mes no lo tiene, se sigue hacia atrás). */
function diaDelMesPasado(hoy: string, dia: number): string | null {
  const { anio, mes, dia: diaHoy } = partes(hoy);
  for (let k = 0; k < 12; k++) {
    const indice = anio * 12 + (mes - 1) - k;
    const a = Math.floor(indice / 12);
    const m = indice - a * 12 + 1;
    if (dia > diasDelMes(a, m)) continue;
    if (k === 0 && dia > diaHoy) continue;
    return conDia(a, m, dia);
  }
  return null;
}

/** Próxima fecha ≥ hoy con ese día del mes. */
function diaDelMesProximo(hoy: string, dia: number): string | null {
  const { anio, mes, dia: diaHoy } = partes(hoy);
  for (let k = 0; k < 12; k++) {
    const indice = anio * 12 + (mes - 1) + k;
    const a = Math.floor(indice / 12);
    const m = indice - a * 12 + 1;
    if (dia > diasDelMes(a, m)) continue;
    if (k === 0 && dia < diaHoy) continue;
    return conDia(a, m, dia);
  }
  return null;
}

/** `el N de MES` → la próxima fecha ≥ hoy (este año o el que sigue); `null` si la fecha no existe. */
export function fechaProximaDeMes(hoy: string, dia: number, mes: number): string | null {
  const { anio } = partes(hoy);
  for (const a of [anio, anio + 1]) {
    if (dia > diasDelMes(a, mes)) return null;
    const fecha = conDia(a, mes, dia);
    if (fecha >= hoy) return fecha;
  }
  return null;
}

/**
 * Fecha al registrar: hoy, ayer/anoche, antier/anteayer, hace N días, el <día de la semana> [pasado], el N
 * (día del mes más reciente ≤ hoy) y el N de <mes> (solo si ya pasó este año). Consume lo leído; `null` sin mover el
 * cursor si ahí no hay fecha.
 */
export function leerFechaRegistro(l: Lector, hoy: string): string | null {
  const inicio = l.marca();
  if (l.palabra('hoy')) return hoy;
  if (l.palabra('ayer', 'anoche')) return sumarDias(hoy, -1);
  if (l.palabra('antier', 'anteayer')) return sumarDias(hoy, -2);
  if (l.palabra('hace')) {
    const n = leerEntero(l, 60);
    if (n !== null && l.palabra('dias', 'dia')) return sumarDias(hoy, -n);
    l.volver(inicio);
    return null;
  }
  if (l.palabra('el')) {
    const token = l.ver();
    const dia = token === undefined ? undefined : DIAS[token];
    if (dia !== undefined) {
      l.pos++;
      l.palabra('pasado');
      return diaPasado(hoy, dia);
    }
    const n = leerEntero(l, 31);
    if (n !== null) {
      if (l.ver() === 'de') {
        const mes = l.ver(1);
        const numeroMes = mes === undefined ? undefined : MESES[mes];
        if (numeroMes !== undefined) {
          l.pos += 2;
          const { anio } = partes(hoy);
          if (n <= diasDelMes(anio, numeroMes)) {
            const fecha = conDia(anio, numeroMes, n);
            if (fecha <= hoy) return fecha;
          }
          l.volver(inicio);
          return null;
        }
      }
      const fecha = diaDelMesPasado(hoy, n);
      if (fecha !== null) return fecha;
    }
    l.volver(inicio);
    return null;
  }
  return null;
}

/** Fecha al simular: hoy, mañana, el <día de la semana> (próximo), el N (próximo) y la quincena (próximo ingreso). */
export function leerFechaSimulacion(
  l: Lector,
  hoy: string,
  proximoIngreso: string | undefined,
): string | null {
  const inicio = l.marca();
  if (l.palabra('hoy')) return hoy;
  if (l.palabra('mañana')) return sumarDias(hoy, 1);
  if (l.alguna(['la', 'proxima', 'quincena'], ['la', 'quincena'])) {
    if (proximoIngreso !== undefined && proximoIngreso >= hoy) return proximoIngreso;
    l.volver(inicio);
    return null;
  }
  if (l.palabra('el')) {
    l.palabra('proximo');
    const token = l.ver();
    const dia = token === undefined ? undefined : DIAS[token];
    if (dia !== undefined) {
      l.pos++;
      return diaProximo(hoy, dia);
    }
    const n = leerEntero(l, 31);
    if (n !== null) {
      const fecha = diaDelMesProximo(hoy, n);
      if (fecha !== null) return fecha;
    }
  }
  l.volver(inicio);
  return null;
}

/**
 * Rango inclusivo de una consulta (§3.1 Rangos): hoy; ayer; antier; esta semana [lunes, hoy]; la semana pasada
 * [lunes, domingo] de la semana anterior; este mes [1, hoy]; el mes pasado [1, último]; esta quincena
 * [ultimo_ingreso, hoy]; los próximos N días [hoy, hoy + N − 1]; este año [1 de enero, hoy].
 */
export function leerPeriodo(l: Lector, hoy: string, ultimoIngreso: string | undefined): Rango | null {
  const inicio = l.marca();
  const { anio, mes } = partes(hoy);
  l.palabra('en', 'de');
  if (l.palabra('hoy')) return { desde: hoy, hasta: hoy };
  if (l.palabra('ayer')) {
    const ayer = sumarDias(hoy, -1);
    return { desde: ayer, hasta: ayer };
  }
  if (l.palabra('antier', 'anteayer')) {
    const antier = sumarDias(hoy, -2);
    return { desde: antier, hasta: antier };
  }
  if (l.secuencia('esta', 'semana')) return { desde: lunesDe(hoy), hasta: hoy };
  if (l.secuencia('la', 'semana', 'pasada')) {
    const lunes = sumarDias(lunesDe(hoy), -7);
    return { desde: lunes, hasta: sumarDias(lunes, 6) };
  }
  if (
    l.secuencia('este', 'mes') ||
    l.alguna(['en', 'lo', 'que', 'va', 'del', 'mes'], ['lo', 'que', 'va', 'del', 'mes'])
  ) {
    return { desde: conDia(anio, mes, 1), hasta: hoy };
  }
  if (l.secuencia('el', 'mes', 'pasado')) {
    const primero = conDia(anio, mes - 1, 1);
    const { anio: a, mes: m } = partes(primero);
    return { desde: primero, hasta: conDia(a, m, diasDelMes(a, m)) };
  }
  if (l.secuencia('esta', 'quincena')) {
    if (ultimoIngreso !== undefined && ultimoIngreso <= hoy) return { desde: ultimoIngreso, hasta: hoy };
    l.volver(inicio);
    return null;
  }
  if (l.secuencia('este', 'año')) return { desde: conDia(anio, 1, 1), hasta: hoy };
  if (l.alguna(['los', 'proximos'], ['los', 'siguientes'], ['estos'])) {
    const n = leerEntero(l, 90);
    if (n !== null && l.palabra('dias')) return { desde: hoy, hasta: sumarDias(hoy, n - 1) };
  }
  l.volver(inicio);
  return null;
}

/** Lunes de la semana de `fecha` (la semana va de lunes a domingo). */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -(diaSemana(fecha) - 1));
}

/**
 * Rango hacia adelante de los pagos que vienen (`compromisos`, 06 §3.1): hoy; mañana; esta semana = los próximos 7
 * días [hoy, hoy + 6] (en domingo «esta semana» ya casi no tiene días); la próxima semana o la semana que viene
 * [lunes, domingo]; este mes [hoy, último día]; el mes que viene [1, último]; esta quincena, hasta la quincena o
 * antes de la quincena [hoy, proximo_ingreso]; los próximos N días [hoy, hoy + N − 1]. Consume lo leído.
 */
export function leerPeriodoAdelante(
  l: Lector,
  hoy: string,
  proximoIngreso: string | undefined,
): Rango | null {
  const inicio = l.marca();
  const { anio, mes } = partes(hoy);
  if (l.palabra('hoy')) return { desde: hoy, hasta: hoy };
  if (l.palabra('mañana')) {
    const manana = sumarDias(hoy, 1);
    return { desde: manana, hasta: manana };
  }
  l.palabra('en', 'para');
  if (l.secuencia('esta', 'semana')) return { desde: hoy, hasta: sumarDias(hoy, 6) };
  if (
    l.alguna(
      ['la', 'proxima', 'semana'],
      ['la', 'semana', 'que', 'viene'],
      ['la', 'siguiente', 'semana'],
      ['la', 'otra', 'semana'],
    )
  ) {
    const lunes = sumarDias(lunesDe(hoy), 7);
    return { desde: lunes, hasta: sumarDias(lunes, 6) };
  }
  if (l.secuencia('este', 'mes') || l.secuencia('lo', 'que', 'queda', 'del', 'mes')) {
    return { desde: hoy, hasta: conDia(anio, mes, diasDelMes(anio, mes)) };
  }
  if (l.alguna(['el', 'mes', 'que', 'viene'], ['el', 'proximo', 'mes'], ['el', 'siguiente', 'mes'])) {
    const primero = conDia(anio, mes + 1, 1);
    const { anio: a, mes: m } = partes(primero);
    return { desde: primero, hasta: conDia(a, m, diasDelMes(a, m)) };
  }
  l.volver(inicio);
  if (
    l.alguna(
      ['esta', 'quincena'],
      ['antes', 'de', 'la', 'quincena'],
      ['antes', 'de', 'mi', 'quincena'],
      ['hasta', 'la', 'quincena'],
      ['hasta', 'mi', 'quincena'],
      ['antes', 'de', 'que', 'me', 'paguen'],
      ['antes', 'de', 'que', 'me', 'paguen', 'la', 'quincena'],
    )
  ) {
    if (proximoIngreso !== undefined && proximoIngreso >= hoy) return { desde: hoy, hasta: proximoIngreso };
    l.volver(inicio);
    return null;
  }
  l.volver(inicio);
  if (l.alguna(['en', 'los', 'proximos'], ['los', 'proximos'], ['los', 'siguientes'], ['estos'])) {
    const n = leerEntero(l, 90);
    if (n !== null && l.palabra('dias')) return { desde: hoy, hasta: sumarDias(hoy, n - 1) };
  }
  l.volver(inicio);
  return null;
}

/** Sin periodo, los pagos que vienen van hasta el próximo ingreso; sin ingreso conocido, los próximos 7 días. */
export function hastaElIngreso(hoy: string, proximoIngreso: string | undefined): Rango {
  return proximoIngreso !== undefined && proximoIngreso >= hoy
    ? { desde: hoy, hasta: proximoIngreso }
    : { desde: hoy, hasta: sumarDias(hoy, 6) };
}

/** Mes en curso [1, hoy] y los mismos días del mes anterior (`comparar_periodos`). */
export function esteMesContraElPasado(hoy: string): { actual: Rango; anterior: Rango } {
  const { anio, mes, dia } = partes(hoy);
  const anterior = conDia(anio, mes - 1, 1);
  const { anio: a, mes: m } = partes(anterior);
  return {
    actual: { desde: conDia(anio, mes, 1), hasta: hoy },
    anterior: { desde: anterior, hasta: conDia(a, m, dia) },
  };
}

/** Mes en curso: [día 1, hoy] (lo mismo que «este mes»). */
export function esteMes(hoy: string): Rango {
  const { anio, mes } = partes(hoy);
  return { desde: conDia(anio, mes, 1), hasta: hoy };
}

/** Ejercicio en curso: [1 de enero, hoy]. */
export function esteAnio(hoy: string): Rango {
  const { anio } = partes(hoy);
  return { desde: conDia(anio, 1, 1), hasta: hoy };
}

/** Últimos 30 días inclusivos: [hoy − 29, hoy]. */
export function ultimosTreintaDias(hoy: string): Rango {
  return { desde: sumarDias(hoy, -29), hasta: hoy };
}
