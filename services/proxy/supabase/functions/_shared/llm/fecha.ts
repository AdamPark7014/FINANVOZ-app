// Fecha de hoy para el modo explicar. El teléfono no manda su fecha en `/llm/turno`, y sin ella el modelo inventa
// periodos ("esta semana", "ayer"). El proxy la toma de su reloj en la hora del centro de México y le da al modelo
// los periodos ya resueltos, para que copie fechas en vez de contarlas. Aritmética entera sobre fechas civiles
// 'YYYY-MM-DD' (sin `Date` para la lógica, regla 6); `Intl` solo convierte el instante a la fecha civil.

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

/** Fecha civil 'YYYY-MM-DD' de un instante (ms) en la zona dada (por omisión, centro de México). */
export function fechaCivil(ms: number, zona = 'America/Mexico_City'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
}

function partes(fecha: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Días desde 1970-01-01 (algoritmo de días civiles de H. Hinnant). */
function aDias(y: number, m: number, d: number): number {
  const a = m <= 2 ? y - 1 : y;
  const era = Math.floor(a / 400);
  const yoe = a - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function deDias(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Línea de contexto con hoy y los periodos frecuentes ya resueltos. `null` si la fecha no es válida (entonces el
 * modelo no recibe fecha y las herramientas usan sus periodos por omisión).
 */
export function contextoFecha(hoy: string): string | null {
  const p = partes(hoy);
  if (!p) return null;
  const [y, m, d] = p;
  const n = aDias(y, m, d);
  if (deDias(n) !== hoy) return null;
  const diaSemana = (((n + 3) % 7) + 7) % 7; // 1970-01-01 fue jueves; 0 = lunes
  const lunes = deDias(n - diaSemana);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMesPasado = deDias(aDias(y, m, 1) - 1);
  const inicioMesPasado = `${finMesPasado.slice(0, 8)}01`;
  return (
    `Hoy es ${DIAS[diaSemana]} ${hoy} (hora del centro de México). Ayer: ${deDias(n - 1)}. ` +
    `Esta semana: del lunes ${lunes} a hoy. Este mes: del ${inicioMes} a hoy. ` +
    `Mes pasado: del ${inicioMesPasado} al ${finMesPasado}. Próximos 7 días: de hoy al ${deDias(n + 6)}.`
  );
}
