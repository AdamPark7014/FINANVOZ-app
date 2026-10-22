import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { z } from 'zod';
import {
  conDia,
  diferenciaDias,
  ErrorDominio,
  minFecha,
  normalizarComercio,
  partes,
  proximasFechas,
  redondearPorcentaje,
  sumarDias,
  sumarMeses,
  type Centavos,
  type PlainDate,
  type Regla,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { procesarApertura } from './apertura';
import type { Contexto } from './contexto';
import { etiquetaFecha } from './formato';
import { inicioUso, transaccionesHistorial } from './historial';
import { calcularLibre, type CalculoLibre } from './hoy';
import type { FiltroMovimientos } from './movimientos';
import { escribirAjuste, leerAjuste } from './preferencias';

const { asiento, cuenta, suscripcion, transaccionVigente: tv } = esquema;

/**
 * Observaciones de Hoy, "Lo que veo" (`02 §4.3`): datos concretos sobre lo que ya pasó o va pasando con el
 * gasto, calculados aquí de forma determinista con `ctx.reloj.hoy()`. Nunca son consejos (`08 §1`): dicen qué
 * pasó, con cifras, y no qué hacer. Cada una tiene umbral; si no se cumple, no sale. Nada de esto va a logs ni
 * a analítica (regla 9, `03 §8`).
 */

/** Máximo visible en Hoy (`02 §4.3`). */
export const MAX_OBSERVACIONES = 2;
/** Gastos que se leen hacia atrás para la mediana y el periodo anterior. */
export const VENTANA_OBSERVACIONES_DIAS = 120;
/** Comparativa: diferencia ≥ 20 % del periodo anterior y ≥ $200. */
export const COMPARATIVA_MIN_PORCENTAJE = 20;
export const COMPARATIVA_MIN_DIFERENCIA: Centavos = 20_000;
/** Gasto fuera de lo normal: últimos 3 días, ≥ 3 × la mediana de los 10 previos (mínimo 5) y ≥ $300. */
export const INUSUAL_DIAS = 3;
export const INUSUAL_PREVIOS_MIN = 5;
export const INUSUAL_PREVIOS_MAX = 10;
export const INUSUAL_VECES = 3;
export const INUSUAL_MIN_MONTO: Centavos = 30_000;
/** Posible cargo doble: últimos 7 días, a ≤ 2 horas si los dos se registraron el día que ocurrieron. */
export const DOBLE_DIAS = 7;
export const DOBLE_MAX_MS = 2 * 60 * 60 * 1000;
/** Ritmo: brecha ≥ 25 puntos entre días transcurridos y gastado de lo libre. */
export const RITMO_BRECHA_MIN = 25;
/** Suscripciones del mes: ≥ 2 detectadas con cargo este mes. */
export const SUSCRIPCIONES_MIN = 2;
/** "Ya lo vi" se recuerda 90 días (ninguna clave vive más que eso). */
const DIAS_VISTAS = 90;

const CLAVE_VISTAS = 'observaciones_vistas';
const Vistas = z.record(z.string(), z.string());
const PREFIJOS = /^(comparativa|inusual|doble|ritmo|suscripciones):/;

/** Periodo del que habla una observación: desde el último ingreso recibido o desde el día 1 del mes. */
export interface PeriodoObservacion {
  readonly inicio: PlainDate;
  /** Nombre del ingreso ("quincena"); `null` = mes calendario. */
  readonly concepto: string | null;
}

interface Base {
  /** Estable por observación y periodo: con ella "Ya lo vi" la oculta (`02 §4.3`). */
  readonly clave: string;
  /** Cifra principal que la UI muestra con `Cifra`. */
  readonly cifra: Centavos;
  /** "Ver movimientos" con este filtro; `null` cuando no aplica. */
  readonly filtro: FiltroMovimientos | null;
  /** 5 = cargo doble … 1 = suscripciones; en empate gana la cifra mayor. */
  readonly relevancia: number;
}

export type Observacion =
  | (Base & {
      readonly tipo: 'comparativa';
      /** Slug de la categoría; `null` si la cuenta de gasto no tiene slug. */
      readonly categoria: string | null;
      /** "comida fuera" */
      readonly nombreCategoria: string;
      readonly actual: Centavos;
      readonly anterior: Centavos;
      readonly periodo: PeriodoObservacion;
    })
  | (Base & {
      readonly tipo: 'inusual';
      readonly transaccionId: string;
      readonly categoria: string | null;
      readonly nombreCategoria: string;
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly cuando: 'hoy' | 'ayer' | 'antier';
      /** Mediana baja de los gastos previos de la categoría. */
      readonly mediana: Centavos;
    })
  | (Base & {
      readonly tipo: 'doble';
      /** Ids en orden. */
      readonly transacciones: readonly [string, string];
      readonly monto: Centavos;
      readonly fecha: PlainDate;
      readonly cuando: 'hoy' | 'ayer' | 'otro';
      /** "mar 13" */
      readonly etiquetaFecha: string;
      readonly comercio: string | null;
      readonly descripcion: string | null;
    })
  | (Base & {
      readonly tipo: 'ritmo';
      readonly periodo: PeriodoObservacion & { readonly concepto: string };
      readonly porcentajeDias: number;
      readonly porcentajeGastado: number;
      /** Gastado de lo libre desde el inicio del periodo (sin lo que cubrió un compromiso). */
      readonly gastado: Centavos;
      /** Libre de hoy + gastado. */
      readonly libreInicial: Centavos;
      readonly diasTranscurridos: number;
      readonly diasTotales: number;
    })
  | (Base & {
      readonly tipo: 'suscripciones';
      /** "2026-10" */
      readonly mes: string;
      readonly total: Centavos;
      readonly cantidad: number;
    });

// ——— Lectura del libro ———

interface FilaGasto {
  readonly id: string;
  readonly fecha: PlainDate;
  readonly tipo: string;
  readonly comercio: string | null;
  readonly descripcion: string | null;
  readonly registradaEn: number;
  readonly extraordinaria: boolean;
  readonly porRevisar: boolean;
  readonly estimada: boolean;
  readonly slug: string | null;
  readonly nombre: string;
  readonly monto: Centavos;
}

/**
 * Asientos en cuentas de gasto del espacio personal de las transacciones vigentes (sin anuladas ni reversas; de
 * una corrección, solo la nueva) con fecha en `[desde, hasta]`, como los cuenta `consultas.ts`.
 */
function filasGasto(ctx: Contexto, desde: PlainDate, hasta: PlainDate): FilaGasto[] {
  return ctx.db
    .select({
      id: tv.id,
      fecha: tv.fecha,
      tipo: tv.tipo,
      comercio: tv.comercio,
      descripcion: tv.descripcion,
      registradaEn: tv.registradaEn,
      extraordinaria: tv.extraordinaria,
      porRevisar: tv.porRevisar,
      estimada: tv.estimada,
      slug: cuenta.categoriaSlug,
      nombre: cuenta.nombre,
      monto: asiento.monto,
    })
    .from(asiento)
    .innerJoin(tv, eq(tv.id, asiento.transaccionId))
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(
      and(
        eq(cuenta.naturaleza, 'gasto'),
        eq(cuenta.espacio, 'personal'),
        ne(tv.tipo, 'saldo_inicial'),
        gte(tv.fecha, desde),
        lte(tv.fecha, hasta),
      ),
    )
    .all()
    .map((f) => ({
      id: f.id,
      fecha: f.fecha,
      tipo: f.tipo,
      comercio: f.comercio,
      descripcion: f.descripcion,
      registradaEn: f.registradaEn,
      extraordinaria: f.extraordinaria === 1,
      porRevisar: f.porRevisar === 1,
      estimada: f.estimada === 1,
      slug: f.slug,
      nombre: f.nombre,
      monto: f.monto,
    }));
}

/** Un gasto (`tipo = 'gasto'`) con su categoría y monto; en orden de fecha, registro e id. */
interface GastoSimple {
  readonly id: string;
  readonly fecha: PlainDate;
  readonly registradaEn: number;
  readonly comercio: string | null;
  readonly descripcion: string | null;
  readonly slug: string | null;
  readonly nombre: string;
  readonly monto: Centavos;
  readonly extraordinaria: boolean;
  readonly porRevisar: boolean;
  readonly estimada: boolean;
}

function gastosSimples(filas: readonly FilaGasto[]): GastoSimple[] {
  const porId = new Map<string, GastoSimple>();
  for (const f of filas) {
    if (f.tipo !== 'gasto') continue;
    const previo = porId.get(f.id);
    if (previo) porId.set(f.id, { ...previo, monto: previo.monto + f.monto });
    else {
      porId.set(f.id, {
        id: f.id,
        fecha: f.fecha,
        registradaEn: f.registradaEn,
        comercio: f.comercio,
        descripcion: f.descripcion,
        slug: f.slug,
        nombre: f.nombre,
        monto: f.monto,
        extraordinaria: f.extraordinaria,
        porRevisar: f.porRevisar,
        estimada: f.estimada,
      });
    }
  }
  return [...porId.values()]
    .filter((g) => g.monto > 0)
    .sort(
      (a, b) =>
        (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
        a.registradaEn - b.registradaEn ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

interface CategoriaGasto {
  readonly clave: string;
  readonly slug: string | null;
  readonly nombre: string;
  readonly monto: Centavos;
}

/** Gasto por categoría en `[desde, hasta]`, de mayor a menor (empate por nombre), solo montos positivos. */
function porCategoria(filas: readonly FilaGasto[], desde: PlainDate, hasta: PlainDate): CategoriaGasto[] {
  const suma = new Map<string, CategoriaGasto>();
  for (const f of filas) {
    if (f.fecha < desde || f.fecha > hasta) continue;
    const clave = f.slug ?? f.nombre;
    const actual = suma.get(clave);
    suma.set(clave, {
      clave,
      slug: f.slug,
      nombre: f.nombre,
      monto: (actual?.monto ?? 0) + f.monto,
    });
  }
  return [...suma.values()]
    .filter((c) => c.monto > 0)
    .sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es'));
}

const categoriaClave = (g: { slug: string | null; nombre: string }) => g.slug ?? g.nombre;

// ——— Periodo ———

interface PeriodoActual extends PeriodoObservacion {
  readonly regla: Regla | null;
}

/**
 * Periodo actual: desde el último ingreso recibido (E3.3, `calcularLibre.recibidas`) hasta hoy; sin ingreso
 * que defina horizonte (o en modo variable), desde el día 1 del mes.
 */
function periodoActual(c: CalculoLibre): PeriodoActual {
  const { hoy, ingreso, recibidas, h } = c;
  if (ingreso && h.estado !== 'ingreso_variable') {
    const pasadas = [...recibidas].filter((f) => f <= hoy).sort();
    const inicio = pasadas[pasadas.length - 1];
    if (inicio !== undefined) return { inicio, concepto: ingreso.concepto, regla: ingreso.regla };
  }
  const { anio, mes } = partes(hoy);
  return { inicio: conDia(anio, mes, 1), concepto: null, regla: null };
}

/** Inicio del periodo anterior: el ingreso previo según la regla, o el mes previo; `null` si no se conoce. */
function inicioAnterior(p: PeriodoActual): PlainDate | null {
  if (p.regla === null) return sumarMeses(p.inicio, -1);
  const previas = proximasFechas(p.regla, sumarDias(p.inicio, -45), 8).filter((f) => f < p.inicio);
  return previas[previas.length - 1] ?? null;
}

// ——— Observaciones ———

/** 1. Comparativa de la categoría con más gasto contra los mismos días del periodo anterior. */
function comparativa(
  filas: readonly FilaGasto[],
  hoy: PlainDate,
  periodo: PeriodoActual,
  anterior: PlainDate | null,
  inicio: PlainDate,
): Observacion[] {
  // El periodo anterior debe estar completo en el historial: si no, la comparación mentiría (regla 12).
  if (anterior === null || anterior < inicio) return [];
  const dias = diferenciaDias(periodo.inicio, hoy) + 1;
  const finAnterior = minFecha(sumarDias(anterior, dias - 1), sumarDias(periodo.inicio, -1));
  const top = porCategoria(filas, periodo.inicio, hoy)[0];
  if (!top) return [];
  const previo = porCategoria(filas, anterior, finAnterior).find((c) => c.clave === top.clave)?.monto ?? 0;
  const diferencia = Math.abs(top.monto - previo);
  if (diferencia < COMPARATIVA_MIN_DIFERENCIA) return [];
  if (diferencia * 100 < COMPARATIVA_MIN_PORCENTAJE * previo) return [];
  return [
    {
      tipo: 'comparativa',
      clave: `comparativa:${top.clave}:${periodo.inicio}`,
      cifra: top.monto,
      relevancia: 2,
      filtro: {
        desde: periodo.inicio,
        hasta: hoy,
        soloGastos: true,
        ...(top.slug ? { categorias: [top.slug] } : {}),
      },
      categoria: top.slug,
      nombreCategoria: top.nombre.toLowerCase(),
      actual: top.monto,
      anterior: previo,
      periodo: { inicio: periodo.inicio, concepto: periodo.concepto },
    },
  ];
}

/** Mediana baja (como E14): el elemento central inferior de la lista ordenada. */
function medianaBaja(montos: readonly Centavos[]): Centavos {
  const ordenados = [...montos].sort((a, b) => a - b);
  return ordenados[Math.floor((ordenados.length - 1) / 2)] ?? 0;
}

/** 2. Un gasto de los últimos 3 días muy por encima de lo normal en su categoría. */
function inusual(gastos: readonly GastoSimple[], hoy: PlainDate): Observacion[] {
  const desde = sumarDias(hoy, -(INUSUAL_DIAS - 1));
  const salida: Observacion[] = [];
  const limpios = gastos.filter((g) => !g.extraordinaria && !g.porRevisar && !g.estimada);
  limpios.forEach((g, i) => {
    if (g.fecha < desde || g.monto < INUSUAL_MIN_MONTO) return;
    const clave = categoriaClave(g);
    const previos: GastoSimple[] = [];
    for (let j = i - 1; j >= 0 && previos.length < INUSUAL_PREVIOS_MAX; j--) {
      const h = limpios[j];
      if (h && categoriaClave(h) === clave) previos.push(h);
    }
    if (previos.length < INUSUAL_PREVIOS_MIN) return;
    const mediana = medianaBaja(previos.map((p) => p.monto));
    if (g.monto < INUSUAL_VECES * mediana) return;
    const masAntiguo = previos[previos.length - 1];
    const transcurridos = diferenciaDias(g.fecha, hoy);
    salida.push({
      tipo: 'inusual',
      clave: `inusual:${g.id}`,
      cifra: g.monto,
      relevancia: 4,
      filtro: {
        desde: masAntiguo ? masAntiguo.fecha : g.fecha,
        hasta: hoy,
        soloGastos: true,
        ...(g.slug ? { categorias: [g.slug] } : {}),
      },
      transaccionId: g.id,
      categoria: g.slug,
      nombreCategoria: g.nombre.toLowerCase(),
      monto: g.monto,
      fecha: g.fecha,
      cuando: transcurridos === 0 ? 'hoy' : transcurridos === 1 ? 'ayer' : 'antier',
      mediana,
    });
  });
  return salida;
}

/**
 * Dos registros del mismo día a ≤ 2 horas por `registrada_en`, cuando los dos se registraron el día que
 * ocurrieron; si alguno se registró con fecha pasada (o el reloj no sabe la fecha civil), basta el mismo día.
 */
function cercanos(ctx: Contexto, a: GastoSimple, b: GastoSimple): boolean {
  const fechaDe = (ms: number): PlainDate | null => ctx.reloj.fechaDe?.(ms) ?? null;
  if (fechaDe(a.registradaEn) === a.fecha && fechaDe(b.registradaEn) === b.fecha) {
    return Math.abs(a.registradaEn - b.registradaEn) <= DOBLE_MAX_MS;
  }
  return true;
}

/** 3. Posible cargo doble: mismo monto, mismo día y mismo comercio (o descripción) normalizados (E9.1). */
function cargoDoble(ctx: Contexto, gastos: readonly GastoSimple[], hoy: PlainDate): Observacion[] {
  const desde = sumarDias(hoy, -(DOBLE_DIAS - 1));
  const grupos = new Map<string, GastoSimple[]>();
  for (const g of gastos) {
    // De los duplicados de capturas por revisar se ocupa la captura (`02 §6`).
    if (g.fecha < desde || g.porRevisar || g.estimada) continue;
    const llave = normalizarComercio(g.comercio) || normalizarComercio(g.descripcion);
    if (llave === '') continue;
    const k = `${g.fecha}|${g.monto}|${llave}`;
    grupos.set(k, [...(grupos.get(k) ?? []), g]);
  }
  const salida: Observacion[] = [];
  for (const grupo of grupos.values()) {
    for (let i = 1; i < grupo.length; i++) {
      const a = grupo[i - 1];
      const b = grupo[i];
      if (!a || !b || !cercanos(ctx, a, b)) continue;
      const [primero, segundo] = [a.id, b.id].sort() as [string, string];
      const transcurridos = diferenciaDias(b.fecha, hoy);
      salida.push({
        tipo: 'doble',
        clave: `doble:${primero}:${segundo}`,
        cifra: b.monto,
        relevancia: 5,
        filtro: { desde: b.fecha, hasta: b.fecha, soloGastos: true },
        transacciones: [primero, segundo],
        monto: b.monto,
        fecha: b.fecha,
        cuando: transcurridos === 0 ? 'hoy' : transcurridos === 1 ? 'ayer' : 'otro',
        etiquetaFecha: etiquetaFecha(b.fecha),
        comercio: b.comercio,
        descripcion: b.comercio ? null : b.descripcion,
      });
      break;
    }
  }
  return salida;
}

/** 4. Ritmo del periodo: días transcurridos (hoy incluido) contra gastado de lo libre del periodo. */
function ritmo(ctx: Contexto, c: CalculoLibre, periodo: PeriodoActual, inicio: PlainDate): Observacion[] {
  const { hoy, h, r } = c;
  // Solo con un ingreso que define horizonte, en estado normal y con el periodo completo en el historial.
  if (periodo.concepto === null || h.estado !== 'normal' || periodo.inicio < inicio || r.libre < 0) return [];
  const diasTotales = diferenciaDias(periodo.inicio, h.fin);
  const diasTranscurridos = diferenciaDias(periodo.inicio, hoy) + 1;
  if (diasTotales <= 0 || diasTranscurridos > diasTotales) return [];
  // Lo gastado de lo libre: como el historial de E8.2, sin lo que cubrió un compromiso (eso estaba reservado).
  const gastado = transaccionesHistorial(ctx, periodo.inicio, hoy)
    .filter((t) => !t.cubre_ocurrencia)
    .reduce((s, t) => s + t.monto_gasto, 0);
  const libreInicial = r.libre + gastado;
  if (gastado < 0 || libreInicial <= 0) return [];
  const porcentajeDias = redondearPorcentaje(diasTranscurridos, diasTotales);
  const porcentajeGastado = redondearPorcentaje(gastado, libreInicial);
  if (Math.abs(porcentajeGastado - porcentajeDias) < RITMO_BRECHA_MIN) return [];
  return [
    {
      tipo: 'ritmo',
      clave: `ritmo:${periodo.inicio}`,
      cifra: gastado,
      relevancia: 3,
      filtro: { desde: periodo.inicio, hasta: hoy, soloGastos: true },
      periodo: { inicio: periodo.inicio, concepto: periodo.concepto },
      porcentajeDias,
      porcentajeGastado,
      gastado,
      libreInicial,
      diasTranscurridos,
      diasTotales,
    },
  ];
}

/**
 * 5. Suscripciones del mes: cargos del mes en curso de las suscripciones que E14 ya detectó (tabla
 * `suscripcion`, sin "Ya la cancelé" ni "No es suscripción"). No corre E14: lo hace la tarea diaria (`03 §7`).
 */
function suscripcionesDelMes(ctx: Contexto, gastos: readonly GastoSimple[], hoy: PlainDate): Observacion[] {
  const detectadas = new Set(
    ctx.db
      .select({ comercio: suscripcion.comercioNormalizado })
      .from(suscripcion)
      .where(inArray(suscripcion.estado, ['detectada', 'compromiso']))
      .all()
      .map((f) => f.comercio),
  );
  if (detectadas.size < SUSCRIPCIONES_MIN) return [];
  const { anio, mes } = partes(hoy);
  const inicioMes = conDia(anio, mes, 1);
  const comercios = new Set<string>();
  const slugs = new Set<string>();
  let total = 0;
  for (const g of gastos) {
    if (g.fecha < inicioMes || g.comercio === null) continue;
    const normalizado = normalizarComercio(g.comercio);
    if (!detectadas.has(normalizado)) continue;
    comercios.add(normalizado);
    total += g.monto;
    if (g.slug) slugs.add(g.slug);
  }
  if (comercios.size < SUSCRIPCIONES_MIN) return [];
  const clave = `${anio}-${String(mes).padStart(2, '0')}`;
  return [
    {
      tipo: 'suscripciones',
      clave: `suscripciones:${clave}`,
      cifra: total,
      relevancia: 1,
      filtro: {
        desde: inicioMes,
        hasta: hoy,
        soloGastos: true,
        ...(slugs.size > 0 ? { categorias: [...slugs].sort() } : {}),
      },
      mes: clave,
      total,
      cantidad: comercios.size,
    },
  ];
}

// ——— "Ya lo vi" ———

/** Claves ya vistas con la fecha en que se ocultaron. */
export function observacionesVistas(ctx: Contexto): Readonly<Record<string, PlainDate>> {
  return leerAjuste(ctx, CLAVE_VISTAS, Vistas) ?? {};
}

/** "Ya lo vi": la observación no vuelve a salir en su periodo; las vistas de más de 90 días se olvidan. */
export function marcarObservacionVista(ctx: Contexto, clave: string): void {
  exigirConsentimiento(ctx);
  if (!PREFIJOS.test(clave)) throw new ErrorDominio('observacion_invalida', 'esa observación no existe');
  const hoy = ctx.reloj.hoy();
  const limite = sumarDias(hoy, -DIAS_VISTAS);
  const vigentes = Object.fromEntries(
    Object.entries(observacionesVistas(ctx)).filter(([, fecha]) => fecha >= limite),
  );
  escribirAjuste(ctx, CLAVE_VISTAS, Vistas, { ...vigentes, [clave]: hoy });
}

// ——— Entrada ———

const porRelevancia = (a: Observacion, b: Observacion): number =>
  b.relevancia - a.relevancia || b.cifra - a.cifra || (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0);

/**
 * Las observaciones de Hoy (`02 §4.3`): a lo más `MAX_OBSERVACIONES`, en orden de relevancia y sin las ya
 * vistas. Determinista: todo sale del libro y de `ctx.reloj.hoy()`.
 */
export function obtenerObservaciones(ctx: Contexto): Observacion[] {
  procesarApertura(ctx);
  const c = calcularLibre(ctx);
  const hoy = c.hoy;
  const periodo = periodoActual(c);
  const anterior = inicioAnterior(periodo);
  const inicio = inicioUso(ctx);
  const desde = minFecha(sumarDias(hoy, -VENTANA_OBSERVACIONES_DIAS), anterior ?? hoy);
  const filas = filasGasto(ctx, desde, hoy);
  const gastos = gastosSimples(filas);
  const todas: Observacion[] = [
    ...cargoDoble(ctx, gastos, hoy),
    ...inusual(gastos, hoy),
    ...ritmo(ctx, c, periodo, inicio),
    ...comparativa(filas, hoy, periodo, anterior, inicio),
    ...suscripcionesDelMes(ctx, gastos, hoy),
  ];
  const vistas = observacionesVistas(ctx);
  return todas
    .filter((o) => !(o.clave in vistas))
    .sort(porRelevancia)
    .slice(0, MAX_OBSERVACIONES);
}
