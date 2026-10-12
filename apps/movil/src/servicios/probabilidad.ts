import { and, asc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  brier,
  BRIER_OBJETIVO,
  estadoDatos,
  fnv1a32,
  maxFecha,
  porcentajeMostrado,
  probabilidadBp,
  semillaDelDia,
  sumarDias,
  VERSION_SIMULADOR,
  type Centavos,
  type EntradaSimulacion,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { procesarApertura } from './apertura';
import { simularPorBloques, type OpcionesBloques } from './bloques';
import type { Contexto } from './contexto';
import { historialSimulacion } from './historial';
import { calcularLibre, type CalculoLibre } from './hoy';
import { borrarAjuste, escribirAjuste, leerAjuste } from './preferencias';

const { prediccion } = esquema;

/** Trayectorias de Hoy (E8.4: `K = 1`, `N = 10 000`). */
export const N_HOY = 10000;

/** Copy de `02 §4.2`. */
export const MENSAJE_DATOS_INSUFICIENTES = 'Necesito 2 semanas de tus gastos para estimar si llegas.';
export const ETIQUETA_ESTIMACION_INICIAL = 'estimación inicial';

/** Probabilidad de Hoy (RF-HOY-02, `02 §4`) ya lista para pintar. */
export type VistaProbabilidadHoy =
  /** Sin ingreso configurado: Hoy pide la frecuencia y no muestra probabilidad. */
  | { readonly estado: 'sin_ingreso' }
  /** < 14 días de historial: probabilidad oculta y el mensaje. */
  | { readonly estado: 'datos_insuficientes'; readonly diasHistorial: number; readonly mensaje: string }
  | {
      readonly estado: 'ok';
      readonly hoy: PlainDate;
      /** "87 %", "< 1 %", "> 99 %" (E1.3). */
      readonly porcentaje: string;
      /** "87 % de llegar sin tocar tu colchón". */
      readonly texto: string;
      /** Para el ancho de la barra (0–1). */
      readonly probabilidad: number;
      readonly exitos: number;
      readonly n: number;
      /** "estimación inicial" con 14–41 días de historial; `null` después. */
      readonly etiqueta: string | null;
      readonly diasHistorial: number;
      /** H₀ simulado: `[hoy, fin_efectivo)`. */
      readonly horizonte: { readonly inicio: PlainDate; readonly fin: PlainDate };
      /** Excedente al final de H₀ en los percentiles 10, 50 y 90 (centavos). */
      readonly p10: Centavos;
      readonly p50: Centavos;
      readonly p90: Centavos;
      /** Vino de la caché del día (mismo libro, misma semilla). */
      readonly desdeCache: boolean;
    };

export type PreparacionHoy =
  | { readonly estado: 'sin_ingreso' }
  | { readonly estado: 'datos_insuficientes'; readonly diasHistorial: number }
  | {
      readonly estado: 'listo';
      readonly entrada: EntradaSimulacion;
      /** Huella de la entrada: si el libro no cambió, la caché del día vale. */
      readonly clave: number;
      readonly diasHistorial: number;
      readonly calculo: CalculoLibre;
    };

/**
 * Entrada de E8 para Hoy (`03 §5.3`): `K = 1` con `H₀ = [hoy, fin_efectivo)` (30 días en ingreso variable),
 * `E₀ = libre` de E4, historial de E8.2 y la semilla del día. No escribe nada (quien llama ya corrió
 * `procesarApertura`).
 */
export function prepararProbabilidadHoy(ctx: Contexto): PreparacionHoy {
  const calculo = calcularLibre(ctx);
  if (!calculo.ingreso && !calculo.variable) return { estado: 'sin_ingreso' };
  const { hoy, h, r } = calculo;
  const hist = historialSimulacion(ctx, hoy);
  const diasHistorial = hist.historial.length;
  if (estadoDatos(diasHistorial) === 'datos_insuficientes')
    return { estado: 'datos_insuficientes', diasHistorial };
  const entrada: EntradaSimulacion = {
    historial: hist.historial,
    horizontes: [
      { inicio: hoy, fin: maxFecha(h.fin_efectivo, sumarDias(hoy, 1)), ingreso: 0, compromisos: 0 },
    ],
    excedente_inicial: r.libre,
    n: N_HOY,
    semilla: semillaDelDia(hoy),
    ...(hist.hoyEsDiaDePago ? { hoy_es_dia_de_pago: true } : {}),
  };
  return { estado: 'listo', entrada, clave: claveEntrada(entrada), diasHistorial, calculo };
}

function claveEntrada(entrada: EntradaSimulacion): number {
  return fnv1a32(`${VERSION_SIMULADOR}|${JSON.stringify(entrada)}`);
}

// ——— Caché del día ———

const CLAVE_CACHE = 'probabilidad_hoy';
const CacheProbabilidad = z.strictObject({
  fecha: z.string(),
  clave: z.int(),
  version: z.string(),
  exitos: z.int(),
  n: z.int(),
  p10: z.int(),
  p50: z.int(),
  p90: z.int(),
});
type CacheProbabilidad = z.infer<typeof CacheProbabilidad>;

function leerCache(ctx: Contexto, hoy: PlainDate, clave: number): CacheProbabilidad | null {
  const c = leerAjuste(ctx, CLAVE_CACHE, CacheProbabilidad);
  return c && c.fecha === hoy && c.clave === clave && c.version === VERSION_SIMULADOR ? c : null;
}

function vistaOk(
  p: Extract<PreparacionHoy, { estado: 'listo' }>,
  c: CacheProbabilidad,
  desdeCache: boolean,
): VistaProbabilidadHoy {
  const porcentaje = porcentajeMostrado(c.exitos, c.n);
  const h0 = p.entrada.horizontes[0] as { inicio: PlainDate; fin: PlainDate };
  return {
    estado: 'ok',
    hoy: c.fecha,
    porcentaje,
    texto: `${porcentaje} de llegar sin tocar tu colchón`,
    probabilidad: c.exitos / c.n,
    exitos: c.exitos,
    n: c.n,
    etiqueta: estadoDatos(p.diasHistorial) === 'estimacion_inicial' ? ETIQUETA_ESTIMACION_INICIAL : null,
    diasHistorial: p.diasHistorial,
    horizonte: { inicio: h0.inicio, fin: h0.fin },
    p10: c.p10,
    p50: c.p50,
    p90: c.p90,
    desdeCache,
  };
}

/**
 * La probabilidad de hoy si ya está calculada para este libro (síncrono, para pintar Hoy sin esperar); `null` si
 * hay que calcular con `obtenerProbabilidadHoy`.
 */
export function leerProbabilidadHoy(ctx: Contexto): VistaProbabilidadHoy | null {
  const p = prepararProbabilidadHoy(ctx);
  if (p.estado === 'sin_ingreso') return p;
  if (p.estado === 'datos_insuficientes') {
    return {
      estado: 'datos_insuficientes',
      diasHistorial: p.diasHistorial,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    };
  }
  const c = leerCache(ctx, p.calculo.hoy, p.clave);
  return c ? vistaOk(p, c, true) : null;
}

/**
 * Probabilidad de Hoy (RF-HOY-02): E8 con `K = 1` por bloques (`setTimeout(0)` entre bloques, la UI no se
 * congela). La semilla es la del día y el resultado se guarda en caché: volver a abrir Hoy el mismo día con el
 * mismo libro da exactamente lo mismo sin recalcular (CA-M6-06). También alimenta la calibración (E8.6).
 */
export async function obtenerProbabilidadHoy(
  ctx: Contexto,
  opciones: OpcionesBloques = {},
): Promise<VistaProbabilidadHoy> {
  procesarApertura(ctx);
  const p = prepararProbabilidadHoy(ctx);
  if (p.estado === 'sin_ingreso') return p;
  if (p.estado === 'datos_insuficientes') {
    return {
      estado: 'datos_insuficientes',
      diasHistorial: p.diasHistorial,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    };
  }
  const hoy = p.calculo.hoy;
  let cache = leerCache(ctx, hoy, p.clave);
  const desdeCache = cache !== null;
  if (!cache) {
    const r = await simularPorBloques(p.entrada, opciones);
    if (r.estado !== 'ok') {
      return {
        estado: 'datos_insuficientes',
        diasHistorial: p.diasHistorial,
        mensaje: MENSAJE_DATOS_INSUFICIENTES,
      };
    }
    cache = {
      fecha: hoy,
      clave: p.clave,
      version: VERSION_SIMULADOR,
      exitos: r.exitos,
      n: p.entrada.n,
      p10: r.p10_h0,
      p50: r.p50_h0,
      p90: r.p90_h0,
    };
    // Si la persona registró algo mientras se calculaba, este resultado ya no es el del libro: no se guarda.
    const vigente = prepararProbabilidadHoy(ctx);
    if (vigente.estado === 'listo' && vigente.clave === p.clave)
      escribirAjuste(ctx, CLAVE_CACHE, CacheProbabilidad, cache);
  }
  registrarCalibracion(ctx, p.calculo, probabilidadBp(cache.exitos, cache.n));
  return vistaOk(p, cache, desdeCache);
}

// ——— Calibración local (E8.6) ———

const Observacion = z.strictObject({ fecha: z.string(), libre: z.int() });
const claveObservacion = (fin: PlainDate) => `calibracion:${fin}`;

/**
 * E8.6 con el reloj inyectado. Un horizonte se identifica por la fecha del ingreso que lo cierra (`fin` de E3.3).
 * - Al iniciarlo (primera probabilidad del periodo) se guarda `{p_predicha (K = 1), fecha}` en `prediccion`.
 * - Mientras dura, cada apertura de Hoy guarda el excedente observado (`libre` de E4 = `E` de E8).
 * - Al cerrarlo (el horizonte actual ya es otro: llegó o se omitió el ingreso) se guarda
 *   `resultado = E_final ≥ 0` con la última observación del periodo.
 * Solo con un ingreso que define horizonte: en modo ingreso variable el horizonte se desliza cada día.
 */
export function registrarCalibracion(ctx: Contexto, calculo: CalculoLibre, pBp: number): void {
  const { hoy, ingreso, h, r } = calculo;
  if (!ingreso || h.estado === 'ingreso_variable') return;
  cerrarHorizontes(ctx, h.fin);
  escribirAjuste(ctx, claveObservacion(h.fin), Observacion, { fecha: hoy, libre: r.libre });
  const abierta = ctx.db.select().from(prediccion).where(eq(prediccion.horizonteFin, h.fin)).get();
  if (!abierta) {
    ctx.db
      .insert(prediccion)
      .values({
        horizonteInicio: hoy,
        horizonteFin: h.fin,
        probabilidadBp: pBp,
        versionSimulador: VERSION_SIMULADOR,
      })
      .onConflictDoNothing()
      .run();
  }
}

/** Cierra las predicciones de horizontes que terminaron antes del actual (`fin < finActual`). */
export function cerrarHorizontes(ctx: Contexto, finActual: PlainDate): number {
  const abiertas = ctx.db
    .select()
    .from(prediccion)
    .where(and(isNull(prediccion.resultado), lt(prediccion.horizonteFin, finActual)))
    .all();
  for (const p of abiertas) {
    const obs = leerAjuste(ctx, claveObservacion(p.horizonteFin), Observacion);
    // Sin observación (no debería pasar: se escribe junto con la predicción) no se inventa un resultado.
    if (!obs) continue;
    ctx.db
      .update(prediccion)
      .set({ resultado: obs.libre >= 0 ? 1 : 0 })
      .where(eq(prediccion.horizonteInicio, p.horizonteInicio))
      .run();
    borrarAjuste(ctx, claveObservacion(p.horizonteFin));
  }
  return abiertas.length;
}

export interface VistaCalibracion {
  /** Predicciones cerradas (con resultado). */
  readonly cerradas: number;
  readonly abiertas: number;
  /** Brier de E8.6; `null` sin predicciones cerradas. */
  readonly brier: number | null;
  readonly objetivo: number;
  readonly predicciones: readonly {
    readonly inicio: PlainDate;
    readonly fin: PlainDate;
    readonly probabilidadBp: number;
    readonly resultado: boolean | null;
  }[];
}

/** Calibración local (E8.6). Solo se envía agregada y con autorización (M7); aquí no sale del teléfono. */
export function obtenerCalibracion(ctx: Contexto): VistaCalibracion {
  const filas = ctx.db.select().from(prediccion).orderBy(asc(prediccion.horizonteInicio)).all();
  const cerradas = ctx.db.select().from(prediccion).where(isNotNull(prediccion.resultado)).all();
  return {
    cerradas: cerradas.length,
    abiertas: filas.length - cerradas.length,
    brier: brier(cerradas.map((f) => ({ probabilidad_bp: f.probabilidadBp, resultado: f.resultado === 1 }))),
    objetivo: BRIER_OBJETIVO,
    predicciones: filas.map((f) => ({
      inicio: f.horizonteInicio,
      fin: f.horizonteFin,
      probabilidadBp: f.probabilidadBp,
      resultado: f.resultado === null ? null : f.resultado === 1,
    })),
  };
}
