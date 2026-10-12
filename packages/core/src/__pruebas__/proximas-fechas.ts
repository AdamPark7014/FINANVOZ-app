import {
  ajustarFinDeSemana,
  conDia,
  diaSemana,
  partes,
  sumarDias,
  type ModoFinDeSemana,
  type PlainDate,
} from '../fecha';

/**
 * Sustituto de prueba de E3.2 `proximasFechas` (`docs/05-MOTORES.md §E3.2`), limitado a las reglas que
 * usan los vectores de E11. Los motores de tandas reciben el generador inyectado; en producción se les
 * pasa el `proximasFechas` real de E3.
 */
export type ReglaPrueba =
  | { tipo: 'semanal'; dia_semana: number; ajuste?: ModoFinDeSemana }
  | { tipo: 'quincenal_15_ultimo'; ajuste?: ModoFinDeSemana };

export function proximasFechasPrueba(regla: ReglaPrueba, desde: PlainDate, n: number): PlainDate[] {
  const inicio = sumarDias(desde, -7);
  const fin = sumarDias(desde, 40 * (n + 2));
  const nominales: PlainDate[] = [];
  if (regla.tipo === 'semanal') {
    for (let f = inicio; f <= fin; f = sumarDias(f, 1)) {
      if (diaSemana(f) === regla.dia_semana) nominales.push(f);
    }
  } else {
    let { anio, mes } = partes(inicio);
    while (conDia(anio, mes, 1) <= fin) {
      for (const d of [15, 31]) {
        const f = conDia(anio, mes, d);
        if (f >= inicio && f <= fin) nominales.push(f);
      }
      ({ anio, mes } = partes(conDia(anio, mes + 1, 1)));
    }
  }
  const ajustadas = [...new Set(nominales.map((f) => ajustarFinDeSemana(f, regla.ajuste ?? 'ninguno')))];
  return ajustadas
    .sort()
    .filter((f) => f >= desde)
    .slice(0, n);
}
