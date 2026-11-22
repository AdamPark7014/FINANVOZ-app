import { diasEntre, fechaCorta } from '../util/fecha';

/** Etiqueta humana del siguiente paso respecto a hoy (Ciudad de México, fechas YYYY-MM-DD). */
export function etiquetaSiguientePaso(fecha: string | null, hoy: string): string {
  if (!fecha) return '';
  const d = diasEntre(hoy, fecha);
  if (d < 0) return `Atrasado desde el ${fechaCorta(fecha)}`;
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  return fechaCorta(fecha);
}