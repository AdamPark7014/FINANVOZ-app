/**
 * Reporte del nivel nube contra el golden set (docs/06-NLU.md §8 y §11): aciertos por campo, caso completo,
 * latencia p50/p95, tokens promedio y costo por caso completo correcto. Puro: recibe las grabaciones ya leídas.
 * El reporte solo lleva ids, nombres de campo y agregados; nunca texto dictado ni montos (regla 9).
 */
import { Interpretacion } from '../esquema';
import { compararInterpretacion } from './comparar';
import type { CasoGolden } from './fixtures';

/** Una respuesta grabada (`fixtures/nlu/grabaciones/<proveedor>/<modelo>.jsonl`, una por línea). */
export interface Grabacion {
  id: string;
  proveedor: string;
  modelo: string;
  /** `ok`, `reintento_validacion`, `no_entendi` o el código de error (`proveedor_fallo`, `tiempo_agotado`, …). */
  codigo: string;
  interpretacion: Record<string, unknown> | null;
  /** Entrada total, incluida la leída y la escrita en caché. */
  tokens_entrada: number;
  tokens_salida: number;
  /** De la entrada, leídos y escritos en caché (solo los proveedores que lo reportan; grabaciones viejas: 0). */
  tokens_cache_leidos?: number;
  tokens_cache_escritos?: number;
  latencia_ms: number;
}

/**
 * Precio de la caché respecto al de entrada (Anthropic: lectura 0.1×, escritura de 1 h 2×; la de 5 min es 1.25×).
 * El intérprete y el modo explicar escriben el prefijo con vida de 1 h (`CACHE_PREFIJO` del proxy). Solo cuenta para
 * los tokens que el proveedor reporta como de caché; los demás se cobran a precio de entrada.
 */
export const FACTOR_CACHE_LECTURA = 0.1;
export const FACTOR_CACHE_ESCRITURA = 2;

/** Precio en USD por millón de tokens (`config/nlu/precios.json`); `null` si no está confirmado. */
export interface Precio {
  entrada: number | null;
  salida: number | null;
}

export type CampoMetrica = 'intencion' | 'monto' | 'fecha' | 'cuentas' | 'categoria' | 'completo';

/** Umbrales de 06 §8 (fracción) y latencia p95 de 06 §11. */
export const UMBRALES: Record<CampoMetrica, number> = {
  intencion: 0.97,
  monto: 0.98,
  fecha: 0.97,
  cuentas: 0.95,
  categoria: 0.85,
  completo: 0.9,
};
export const LATENCIA_P95_MAXIMA_MS = 5000;

/** Claves que cuentan para cada campo (en cualquier nivel del esperado). */
const CLAVES: Record<Exclude<CampoMetrica, 'intencion' | 'completo'>, ReadonlySet<string>> = {
  monto: new Set(['monto', 'precio', 'efectivo_real', 'aportacion']),
  fecha: new Set(['fecha', 'desde', 'hasta', 'ancla', 'inicio']),
  cuentas: new Set(['origen', 'destino']),
  categoria: new Set(['categoria']),
};

/** Fallas que invalidan todos los campos del caso. */
const FALLAS_TOTALES = new Set(['intencion', 'sin_respuesta', 'esquema']);

export interface Conteo {
  aciertos: number;
  total: number;
}

export interface ResultadoCasoNube {
  id: string;
  correcto: boolean;
  fallas: string[];
}

export interface ReporteNube {
  proveedor: string;
  modelo: string;
  casos: number;
  /** Ids del golden set sin grabación (cuentan como fallas). */
  faltantes: string[];
  campos: Record<CampoMetrica, Conteo>;
  latencia: { p50: number; p95: number };
  tokens: {
    entrada_promedio: number;
    salida_promedio: number;
    /** Promedio por caso de la entrada leída y escrita en caché. */
    cache_leida_promedio: number;
    cache_escrita_promedio: number;
  };
  /** USD; `null` sin precio confirmado. */
  costo_total: number | null;
  costo_por_correcto: number | null;
  resultados: ResultadoCasoNube[];
  incumplidos: string[];
  cumple: boolean;
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Rutas (con el formato de `compararInterpretacion`) de las claves del esperado que pertenecen a un campo. */
function rutasDeCampo(
  valor: unknown,
  claves: ReadonlySet<string>,
  ruta = '',
  salida: string[] = [],
): string[] {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => rutasDeCampo(v, claves, `${ruta}[${i}]`, salida));
  } else if (esObjeto(valor)) {
    for (const [clave, v] of Object.entries(valor)) {
      const sub = ruta === '' ? clave : `${ruta}.${clave}`;
      if (claves.has(clave)) salida.push(sub);
      else rutasDeCampo(v, claves, sub, salida);
    }
  }
  return salida;
}

const tocan = (falla: string, ruta: string) =>
  falla === ruta ||
  ruta.startsWith(`${falla}.`) ||
  ruta.startsWith(`${falla}[`) ||
  falla.startsWith(`${ruta}.`) ||
  falla.startsWith(`${ruta}[`);

/** Percentil por rango más cercano. */
export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i] ?? 0;
}

export function fallasDeGrabacion(caso: CasoGolden, g: Grabacion | undefined): string[] {
  if (g === undefined || g.interpretacion === null) return ['sin_respuesta'];
  if (!Interpretacion.safeParse(g.interpretacion).success) return ['esquema'];
  return compararInterpretacion(caso.esperado, g.interpretacion);
}

export function evaluarNube(
  casos: readonly CasoGolden[],
  grabaciones: readonly Grabacion[],
  precio: Precio | undefined,
): ReporteNube {
  const primera = grabaciones[0];
  const porId = new Map(grabaciones.map((g) => [g.id, g]));
  const campos = Object.fromEntries(
    (['intencion', 'monto', 'fecha', 'cuentas', 'categoria', 'completo'] as const).map((c) => [
      c,
      { aciertos: 0, total: 0 },
    ]),
  ) as Record<CampoMetrica, Conteo>;
  const resultados: ResultadoCasoNube[] = [];

  for (const caso of casos) {
    const fallas = fallasDeGrabacion(caso, porId.get(caso.id));
    const total = fallas.some((f) => FALLAS_TOTALES.has(f));
    campos.intencion.total += 1;
    if (!total) campos.intencion.aciertos += 1;
    for (const campo of ['monto', 'fecha', 'cuentas', 'categoria'] as const) {
      const rutas = rutasDeCampo(caso.esperado, CLAVES[campo]);
      if (rutas.length === 0) continue;
      campos[campo].total += 1;
      if (!total && !fallas.some((f) => rutas.some((r) => tocan(f, r)))) campos[campo].aciertos += 1;
    }
    campos.completo.total += 1;
    if (fallas.length === 0) campos.completo.aciertos += 1;
    resultados.push({ id: caso.id, correcto: fallas.length === 0, fallas });
  }

  const ids = new Set(casos.map((c) => c.id));
  const usadas = grabaciones.filter((g) => ids.has(g.id));
  const n = Math.max(usadas.length, 1);
  const tokensEntrada = usadas.reduce((s, g) => s + g.tokens_entrada, 0);
  const tokensSalida = usadas.reduce((s, g) => s + g.tokens_salida, 0);
  const leidos = usadas.reduce((s, g) => s + (g.tokens_cache_leidos ?? 0), 0);
  const escritos = usadas.reduce((s, g) => s + (g.tokens_cache_escritos ?? 0), 0);
  // Costo real: la entrada sin caché a precio lleno, la leída y la escrita con su factor.
  const costoTotal =
    precio && precio.entrada !== null && precio.salida !== null
      ? ((tokensEntrada - leidos - escritos) * precio.entrada +
          leidos * precio.entrada * FACTOR_CACHE_LECTURA +
          escritos * precio.entrada * FACTOR_CACHE_ESCRITURA +
          tokensSalida * precio.salida) /
        1_000_000
      : null;
  const latencias = usadas.map((g) => g.latencia_ms);
  const latencia = { p50: percentil(latencias, 50), p95: percentil(latencias, 95) };

  const incumplidos: string[] = [];
  for (const [campo, umbral] of Object.entries(UMBRALES) as [CampoMetrica, number][]) {
    const { aciertos, total } = campos[campo];
    if (total > 0 && aciertos / total < umbral) incumplidos.push(campo);
  }
  if (latencia.p95 >= LATENCIA_P95_MAXIMA_MS) incumplidos.push('latencia_p95');
  const faltantes = casos.filter((c) => !porId.has(c.id)).map((c) => c.id);
  if (faltantes.length > 0) incumplidos.push('faltantes');

  return {
    proveedor: primera?.proveedor ?? '—',
    modelo: primera?.modelo ?? '—',
    casos: casos.length,
    faltantes,
    campos,
    latencia,
    tokens: {
      entrada_promedio: tokensEntrada / n,
      salida_promedio: tokensSalida / n,
      cache_leida_promedio: leidos / n,
      cache_escrita_promedio: escritos / n,
    },
    costo_total: costoTotal,
    costo_por_correcto:
      costoTotal === null || campos.completo.aciertos === 0 ? null : costoTotal / campos.completo.aciertos,
    resultados,
    incumplidos,
    cumple: incumplidos.length === 0,
  };
}

const pct = ({ aciertos, total }: Conteo) =>
  total === 0 ? '—' : `${((aciertos / total) * 100).toFixed(1)} % (${aciertos}/${total})`;

const ETIQUETA: Record<CampoMetrica, string> = {
  intencion: 'intencion',
  monto: 'monto',
  fecha: 'fecha',
  cuentas: 'origen/destino',
  categoria: 'categoria',
  completo: 'caso completo',
};

/** Texto del reporte de eval (stdout de `pnpm eval:nlu --nivel nube` / `--offline`): solo ids, campos y agregados. */
export function formatearReporte(r: ReporteNube): string {
  const lineas = [`Nivel 2 · nube — ${r.proveedor} / ${r.modelo} — ${r.casos} casos`];
  for (const campo of Object.keys(UMBRALES) as CampoMetrica[]) {
    lineas.push(
      `  ${ETIQUETA[campo].padEnd(15)} ${pct(r.campos[campo]).padEnd(22)} umbral ${UMBRALES[campo] * 100} %`,
    );
  }
  lineas.push(
    `  latencia        p50 ${r.latencia.p50} ms · p95 ${r.latencia.p95} ms (máximo p95 ${LATENCIA_P95_MAXIMA_MS} ms)`,
  );
  lineas.push(
    `  tokens          entrada ${r.tokens.entrada_promedio.toFixed(0)} · salida ${r.tokens.salida_promedio.toFixed(0)} (promedio por caso)` +
      (r.tokens.cache_leida_promedio + r.tokens.cache_escrita_promedio > 0
        ? ` · caché leída ${r.tokens.cache_leida_promedio.toFixed(0)} · escrita ${r.tokens.cache_escrita_promedio.toFixed(0)}`
        : ''),
  );
  lineas.push(
    r.costo_total === null
      ? '  costo           sin precio confirmado en config/nlu/precios.json'
      : `  costo           total US$${r.costo_total.toFixed(4)} · por caso completo correcto ` +
          (r.costo_por_correcto === null ? '—' : `US$${r.costo_por_correcto.toFixed(6)}`),
  );
  if (r.faltantes.length > 0) lineas.push(`  sin grabación: ${r.faltantes.join(', ')}`);
  for (const caso of r.resultados.filter((c) => !c.correcto)) {
    lineas.push(`  incorrecto: ${caso.id} (${caso.fallas.join(', ')})`);
  }
  lineas.push(r.cumple ? '  Resultado: cumple' : `  Resultado: no cumple (${r.incumplidos.join(', ')})`);
  return lineas.join('\n');
}
