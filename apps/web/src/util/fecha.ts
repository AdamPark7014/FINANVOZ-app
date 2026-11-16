/** Fecha civil 'YYYY-MM-DD' en la Ciudad de México (no en UTC: después de las 18 h UTC ya es otro día). */
export function hoyMexico(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Suma días a una fecha civil. */
export function sumarDias(fecha: string, dias: number): string {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Primer día del mes de una fecha civil. */
export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 8)}01`;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function partes(fecha: string): { a: number; m: number; d: number } {
  const [a = '0', m = '1', d = '1'] = fecha.slice(0, 10).split('-');
  return { a: Number(a), m: Number(m), d: Number(d) };
}

/** «15 nov» */
export function fechaCorta(fecha: string): string {
  const { m, d } = partes(fecha);
  return `${d} ${(MESES[m - 1] ?? '').slice(0, 3)}`;
}

/** «Noviembre 2026 · al domingo 15» */
export function encabezadoMes(hoy: string): string {
  const { a, m, d } = partes(hoy);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()] ?? '';
  const mes = MESES[m - 1] ?? '';
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${a} · al ${dia} ${d}`;
}

/** Días entre dos fechas civiles (b − a). */
export function diasEntre(a: string, b: string): number {
  const pa = partes(a);
  const pb = partes(b);
  return Math.round((Date.UTC(pb.a, pb.m - 1, pb.d) - Date.UTC(pa.a, pa.m - 1, pa.d)) / 86_400_000);
}
