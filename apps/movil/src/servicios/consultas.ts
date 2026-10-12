import { and, eq, gte, lte, ne } from 'drizzle-orm';
import {
  conDia,
  diaSemana,
  diferenciaDias,
  ErrorDominio,
  partes,
  sumarDias,
  sumarMeses,
  type Centavos,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { normalizarAlias, resolverCuenta, type CuentaResolutor, type Interpretacion } from '@cartera/nlu';
import { cuentasPropias } from './catalogo';
import { procesarApertura } from './apertura';
import type { Contexto } from './contexto';
import { listarCuentas } from './cuentas';
import { etiquetaDiaMes, etiquetaFecha, miles, pesos } from './formato';
import { obtenerHoy } from './hoy';
import type { FiltroMovimientos } from './movimientos';
import { contextoNube } from './nube';
import { listarOcurrencias } from './ocurrencias';
import { listarPersonas } from './personas';
import { ingresoPrincipal } from './programados';
import { listarTarjetas } from './vista-tarjetas';

const { asiento, cuenta, transaccionVigente: tv } = esquema;

/** La `consulta` de una interpretación `consultar` (`06 §3`, ya validada con Zod). */
export type Consulta = Extract<Interpretacion, { intencion: 'consultar' }>['consulta'];

/**
 * Consultas tipadas (`06 §6`, RF-CON-01): cada `consulta.tipo` es una lectura del libro y la respuesta se arma
 * con una plantilla. Ninguna cifra sale del intérprete (regla 4): el intérprete solo dice qué se pregunta y con
 * qué periodo; los montos salen de aquí y de `packages/core`. Nada de esto va a logs (regla 9).
 */

/** Consultas con plantilla en M7; `suscripciones` y `explicar` llegan en M10, las del negocio en M11–M12. */
export const PLANTILLAS_CONSULTA = [
  'hoy_puedes',
  'gasto_total',
  'gasto_por_categoria',
  'saldo',
  'deuda_tarjetas',
  'compromisos',
  'por_cobrar',
  'comparar_periodos',
  'mayores_gastos',
] as const;
export type PlantillaConsulta = (typeof PLANTILLAS_CONSULTA)[number];

export function tienePlantilla(tipo: Consulta['tipo']): tipo is PlantillaConsulta {
  return (PLANTILLAS_CONSULTA as readonly string[]).includes(tipo);
}

/** Una fila de la respuesta ("tanda · mar 13 oct" · "$500"). */
export interface LineaConsulta {
  readonly etiqueta: string;
  readonly valor: string;
}

export interface RespuestaConsulta {
  readonly plantilla: PlantillaConsulta;
  /** La frase de la plantilla: "Esta semana llevas $1,240 en comida (8 movimientos)." */
  readonly texto: string;
  readonly lineas: readonly LineaConsulta[];
  /** "Ver movimientos": abre Movimientos con este filtro. */
  readonly filtro: FiltroMovimientos;
}

/** Grupos para consultas (`04 §2.3`). */
const GRUPOS: Readonly<Record<string, { readonly nombre: string; readonly slugs: readonly string[] }>> = {
  comida: { nombre: 'comida', slugs: ['comida_fuera', 'antojos', 'super'] },
  movilidad: { nombre: 'transporte', slugs: ['transporte', 'gasolina'] },
  casa: { nombre: 'la casa', slugs: ['vivienda', 'servicios', 'hogar'] },
};

// ——— Fechas y nombres ———

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const mes = (f: PlainDate) => MESES[partes(f).mes - 1] as string;

/** "jue 15 oct" (`02 §14`). */
export function fechaCorta(f: PlainDate): string {
  return `${etiquetaFecha(f)} ${mes(f)}`;
}

/** "Del 1 al 11 oct" / "Del 28 sep al 4 oct" / "El 5 oct". */
function rango(desde: PlainDate, hasta: PlainDate): string {
  if (desde === hasta) return `El ${etiquetaDiaMes(desde)}`;
  return mes(desde) === mes(hasta) && partes(desde).anio === partes(hasta).anio
    ? `Del ${partes(desde).dia} al ${etiquetaDiaMes(hasta)}`
    : `Del ${etiquetaDiaMes(desde)} al ${etiquetaDiaMes(hasta)}`;
}

const primeroDelMes = (f: PlainDate) => conDia(partes(f).anio, partes(f).mes, 1);
const lunesDe = (f: PlainDate) => sumarDias(f, 1 - diaSemana(f));

/** "Nu ••4410" → "Nu"; "BBVA Débito ••5521" → "BBVA Débito". */
function nombreCorto(nombre: string): string {
  return nombre.replace(/\s*••\s*\d{2,4}$/, '').trim() || nombre;
}

function cuantos(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Cómo se nombra un periodo de gasto en la frase y si sigue abierto ("llevas") o ya pasó ("gastaste"). */
interface Periodo {
  readonly sujeto: string;
  readonly abierto: boolean;
}

function periodo(ctx: Contexto, desde: PlainDate, hasta: PlainDate): Periodo {
  const hoy = ctx.reloj.hoy();
  if (desde === hasta && hasta === hoy) return { sujeto: 'Hoy', abierto: true };
  if (desde === hasta && hasta === sumarDias(hoy, -1)) return { sujeto: 'Ayer', abierto: false };
  if (hasta === hoy) {
    if (desde === lunesDe(hoy)) return { sujeto: 'Esta semana', abierto: true };
    if (desde === primeroDelMes(hoy)) return { sujeto: 'Este mes', abierto: true };
    if (desde === sumarDias(hoy, -29)) return { sujeto: 'En los últimos 30 días', abierto: true };
    const ingreso = ingresoPrincipal(ctx);
    const ultimo = contextoNube(ctx, hoy).ultimo_ingreso;
    if (ingreso && ultimo === desde) {
      return { sujeto: `Desde tu ${ingreso.concepto} del ${etiquetaDiaMes(desde)}`, abierto: true };
    }
    return { sujeto: `Desde el ${etiquetaDiaMes(desde)}`, abierto: true };
  }
  const anterior = sumarMeses(primeroDelMes(hoy), -1);
  if (desde === anterior && hasta === sumarDias(primeroDelMes(hoy), -1)) {
    return { sujeto: 'El mes pasado', abierto: false };
  }
  return { sujeto: rango(desde, hasta), abierto: hasta >= hoy };
}

// ——— Gasto ———

interface CategoriaGasto {
  readonly slug: string;
  readonly nombre: string;
  readonly monto: Centavos;
}

interface Gasto {
  readonly total: Centavos;
  /** Transacciones con gasto en las categorías pedidas. */
  readonly movimientos: number;
  readonly porCategoria: readonly CategoriaGasto[];
}

/**
 * Gasto del espacio personal en `[desde, hasta]`: Σ de asientos en cuentas de gasto de las transacciones
 * vigentes (sin anuladas ni reversas; de una corrección, solo la nueva). Compras a meses cuentan completas el
 * día de la compra, como se registran (`04 §4`).
 */
function gasto(
  ctx: Contexto,
  desde: PlainDate,
  hasta: PlainDate,
  categorias: readonly string[] | null,
): Gasto {
  const filas = ctx.db
    .select({ transaccionId: tv.id, slug: cuenta.categoriaSlug, nombre: cuenta.nombre, monto: asiento.monto })
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
    .filter((f) => categorias === null || (f.slug !== null && categorias.includes(f.slug)));
  const porSlug = new Map<string, { nombre: string; monto: number }>();
  const porTransaccion = new Map<string, number>();
  for (const f of filas) {
    const slug = f.slug ?? f.nombre;
    const actual = porSlug.get(slug) ?? { nombre: f.nombre, monto: 0 };
    porSlug.set(slug, { nombre: actual.nombre, monto: actual.monto + f.monto });
    porTransaccion.set(f.transaccionId, (porTransaccion.get(f.transaccionId) ?? 0) + f.monto);
  }
  return {
    total: filas.reduce((s, f) => s + f.monto, 0),
    movimientos: [...porTransaccion.values()].filter((m) => m !== 0).length,
    porCategoria: [...porSlug.entries()]
      .map(([slug, v]) => ({ slug, nombre: v.nombre, monto: v.monto }))
      .filter((c) => c.monto > 0)
      .sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/** Slugs y nombre en la frase de una categoría o grupo de la consulta; `null` = todas. */
function categoriaDe(
  ctx: Contexto,
  categoria: Consulta['categoria'],
): { slugs: readonly string[]; nombre: string } | null {
  if (categoria === undefined) return null;
  const grupo = GRUPOS[categoria];
  if (grupo) return { slugs: grupo.slugs, nombre: grupo.nombre };
  const fila = ctx.db
    .select({ nombre: cuenta.nombre })
    .from(cuenta)
    .where(and(eq(cuenta.categoriaSlug, categoria), eq(cuenta.espacio, 'personal')))
    .get();
  return { slugs: [categoria], nombre: (fila?.nombre ?? categoria.replace(/_/g, ' ')).toLowerCase() };
}

function filtroGasto(
  desde: PlainDate,
  hasta: PlainDate,
  cat: { slugs: readonly string[] } | null,
): FiltroMovimientos {
  return { desde, hasta, soloGastos: true, ...(cat ? { categorias: [...cat.slugs] } : {}) };
}

// ——— Plantillas ———

function hoyPuedes(ctx: Contexto): RespuestaConsulta {
  const v = obtenerHoy(ctx);
  const base = { plantilla: 'hoy_puedes' as const, lineas: [], filtro: {} };
  const tu = v.proximoIngreso ? ` antes de tu ${v.proximoIngreso.concepto}` : '';
  switch (v.estado) {
    case 'sin_ingreso':
      return { ...base, texto: 'Dime cada cuándo te pagan y te digo cuánto puedes gastar hoy.' };
    case 'libre_negativo':
      return { ...base, texto: `Hoy: $0. Te faltan ${pesos(v.faltante)} para cubrir lo que viene${tu}.` };
    case 'normal': {
      const cifra = `Hoy puedes gastar $${miles(v.hoyPuedesPesos)}`;
      if (!v.proximoIngreso) return { ...base, texto: `${cifra}.` };
      const faltan = v.dias === 1 ? 'falta 1 día' : `faltan ${v.dias} días`;
      return { ...base, texto: `${cifra}; ${faltan} para tu ${v.proximoIngreso.concepto}.` };
    }
    default:
      return {
        ...base,
        texto: `Hoy puedes gastar $${miles(v.hoyPuedesPesos)}.${v.mensaje ? ` ${v.mensaje}` : ''}`,
      };
  }
}

function gastoTotal(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const hoy = ctx.reloj.hoy();
  const desde = c.desde ?? primeroDelMes(hoy);
  const hasta = c.hasta ?? hoy;
  const cat = categoriaDe(ctx, c.categoria);
  const g = gasto(ctx, desde, hasta, cat?.slugs ?? null);
  const p = periodo(ctx, desde, hasta);
  const verbo = p.abierto ? 'llevas' : 'gastaste';
  const en = cat ? ` en ${cat.nombre}` : '';
  const conteo = cat && g.movimientos > 0 ? ` (${cuantos(g.movimientos, 'movimiento', 'movimientos')})` : '';
  return {
    plantilla: c.tipo === 'gasto_por_categoria' ? 'gasto_por_categoria' : 'gasto_total',
    texto: `${p.sujeto} ${verbo} ${pesos(g.total)}${en}${conteo}.`,
    lineas: [],
    filtro: filtroGasto(desde, hasta, cat),
  };
}

function compararPeriodos(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const hoy = ctx.reloj.hoy();
  const actual = c.actual ?? { desde: primeroDelMes(hoy), hasta: hoy };
  const anterior = c.anterior ?? {
    desde: sumarMeses(actual.desde, -1),
    hasta: sumarMeses(actual.hasta, -1),
  };
  const cat = categoriaDe(ctx, c.categoria);
  const a = gasto(ctx, actual.desde, actual.hasta, cat?.slugs ?? null).total;
  const b = gasto(ctx, anterior.desde, anterior.hasta, cat?.slugs ?? null).total;
  const mismosDias =
    actual.desde === primeroDelMes(actual.desde) &&
    anterior.desde === sumarMeses(actual.desde, -1) &&
    anterior.hasta === sumarMeses(actual.hasta, -1);
  const contra = mismosDias
    ? 'a estas alturas del mes pasado'
    : rango(anterior.desde, anterior.hasta).replace(/^(Del|El)/, (m) => m.toLowerCase());
  const en = cat ? ` en ${cat.nombre}` : ' en tus gastos';
  const dif = a - b;
  const texto =
    dif === 0
      ? `Vas igual${en} que ${contra}.`
      : `Vas ${pesos(Math.abs(dif))} ${dif > 0 ? 'arriba' : 'abajo'}${en} que ${contra}.`;
  return {
    plantilla: 'comparar_periodos',
    texto,
    lineas: [
      { etiqueta: rango(actual.desde, actual.hasta), valor: pesos(a) },
      { etiqueta: rango(anterior.desde, anterior.hasta), valor: pesos(b) },
    ],
    filtro: filtroGasto(actual.desde, actual.hasta, cat),
  };
}

function mayoresGastos(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const hoy = ctx.reloj.hoy();
  const desde = c.desde ?? sumarDias(hoy, -29);
  const hasta = c.hasta ?? hoy;
  const g = gasto(ctx, desde, hasta, null);
  const top = g.porCategoria.slice(0, c.limite ?? 5);
  const p = periodo(ctx, desde, hasta);
  const [primera] = top;
  return {
    plantilla: 'mayores_gastos',
    texto: primera
      ? `${p.sujeto}, lo que más pesa es ${primera.nombre.toLowerCase()}: ${pesos(primera.monto)}.`
      : `${p.sujeto} no tienes gastos registrados.`,
    lineas: top.map((x) => ({ etiqueta: x.nombre, valor: pesos(x.monto) })),
    filtro: filtroGasto(desde, hasta, null),
  };
}

const TIPO_RESOLUTOR: Partial<Record<string, CuentaResolutor['tipo']>> = {
  efectivo: 'efectivo',
  debito: 'debito',
  billetera: 'billetera',
  ahorro: 'debito',
  tarjeta_credito: 'credito',
};

function saldo(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const base = { plantilla: 'saldo' as const };
  const tienes = listarCuentas(ctx).tienes;
  const tarjetas = listarTarjetas(ctx);
  const frase = (id: string): { texto: string; valor: Centavos; nombre: string } | null => {
    const t = tarjetas.find((x) => x.id === id);
    if (t) {
      const nombre = nombreCorto(t.nombre);
      return t.saldoAFavor > 0
        ? {
            texto: `En tu ${nombre} tienes saldo a favor de ${pesos(t.saldoAFavor)}.`,
            valor: -t.saldoAFavor,
            nombre,
          }
        : { texto: `En tu ${nombre} debes ${pesos(t.deudaTotal)}.`, valor: t.deudaTotal, nombre };
    }
    const cta = tienes.find((x) => x.id === id);
    if (!cta) return null;
    const nombre = nombreCorto(cta.nombre);
    return { texto: `En ${nombre} tienes ${pesos(cta.saldo)}.`, valor: cta.saldo, nombre };
  };
  if (c.alias === undefined) {
    const total = tienes.reduce((s, x) => s + x.saldo, 0);
    return {
      ...base,
      texto: `En tus cuentas tienes ${pesos(total)}.`,
      lineas: tienes.map((x) => ({ etiqueta: nombreCorto(x.nombre), valor: pesos(x.saldo) })),
      filtro: {},
    };
  }
  const candidatas: CuentaResolutor[] = [];
  for (const x of cuentasPropias(ctx)) {
    const tipo = TIPO_RESOLUTOR[x.subtipo];
    if (tipo) candidatas.push({ id: x.id, tipo, nombre: x.nombre, alias: x.alias, espacio: 'personal' });
  }
  const r = resolverCuenta({ tipo: 'desconocido', alias: c.alias }, candidatas);
  if (r.resultado === 'cuenta') {
    const f = frase(r.cuenta);
    if (f) return { ...base, texto: f.texto, lineas: [], filtro: { cuentaId: r.cuenta } };
  }
  if (r.resultado === 'ambigua') {
    const lineas = r.candidatas.flatMap((id) => {
      const f = frase(id);
      return f ? [{ etiqueta: f.nombre, valor: pesos(f.valor) }] : [];
    });
    return { ...base, texto: `Tienes varias cuentas «${c.alias}».`, lineas, filtro: {} };
  }
  return { ...base, texto: `No tengo una cuenta «${c.alias}».`, lineas: [], filtro: {} };
}

function deudaTarjetas(ctx: Contexto): RespuestaConsulta {
  const tarjetas = listarTarjetas(ctx);
  const base = { plantilla: 'deuda_tarjetas' as const };
  const filtro: FiltroMovimientos =
    tarjetas.length === 1 ? { cuentaId: (tarjetas[0] as { id: string }).id } : {};
  if (tarjetas.length === 0) {
    return { ...base, texto: 'No tienes tarjetas de crédito registradas.', lineas: [], filtro };
  }
  const total = tarjetas.reduce((s, t) => s + t.deudaTotal, 0);
  const lineas = tarjetas.map((t) => ({ etiqueta: nombreCorto(t.nombre), valor: pesos(t.deudaTotal) }));
  if (total === 0) return { ...base, texto: 'No debes nada en tus tarjetas.', lineas, filtro };
  // Solo con el pago para no generar intereses de un corte ya cerrado; sin él no se adivina la fecha límite.
  const [proxima] = tarjetas
    .filter((t) => t.pngi > 0)
    .sort((a, b) => (a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0));
  const cola = proxima
    ? `; el próximo pago es ${nombreCorto(proxima.nombre)}, ${pesos(proxima.pngi)} el ${fechaCorta(proxima.fechaLimite)}`
    : '';
  return { ...base, texto: `Debes ${pesos(total)} en total${cola}.`, lineas, filtro };
}

function compromisos(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const hoy = ctx.reloj.hoy();
  const desde = c.desde ?? hoy;
  const hasta = c.hasta ?? sumarDias(hoy, 29);
  const pagos = [
    ...listarOcurrencias(ctx, { estado: 'pendiente', tipo: 'egreso' })
      .filter((o) => o.fecha >= desde && o.fecha <= hasta)
      .map((o) => ({ concepto: o.concepto, fecha: o.fecha, monto: o.monto })),
    // Pagos de tarjeta con su pago para no generar intereses ya conocido (`05 §E5.3`).
    ...listarTarjetas(ctx)
      .filter((t) => t.pngi > 0 && t.fechaLimite >= desde && t.fechaLimite <= hasta)
      .map((t) => ({ concepto: `pago de tu ${nombreCorto(t.nombre)}`, fecha: t.fechaLimite, monto: t.pngi })),
  ].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const sujeto =
    desde === hoy
      ? hasta === hoy
        ? 'Hoy'
        : `En los próximos ${diferenciaDias(hoy, hasta) + 1} días`
      : rango(desde, hasta);
  const total = pagos.reduce((s, x) => s + x.monto, 0);
  return {
    plantilla: 'compromisos',
    texto:
      pagos.length === 0
        ? `${sujeto} no tienes pagos.`
        : `${sujeto} tienes ${cuantos(pagos.length, 'pago', 'pagos')} por ${pesos(total)}.`,
    lineas: pagos.map((x) => ({ etiqueta: `${x.concepto} · ${fechaCorta(x.fecha)}`, valor: pesos(x.monto) })),
    filtro: { desde, hasta },
  };
}

function porCobrar(ctx: Contexto, c: Consulta): RespuestaConsulta {
  const quien = c.contraparte === undefined ? null : normalizarAlias(c.contraparte);
  const deben = listarPersonas(ctx)
    .filter((p) => p.saldo > 0)
    .filter((p) => quien === null || normalizarAlias(p.nombre).split(' ').includes(quien))
    .sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre, 'es'));
  const base = { plantilla: 'por_cobrar' as const, lineas: [] };
  const filtro: FiltroMovimientos =
    deben.length === 1 ? { cuentaId: (deben[0] as { cuentaId: string }).cuentaId } : {};
  if (deben.length === 0) {
    return {
      ...base,
      texto: quien === null ? 'Nadie te debe dinero.' : `«${c.contraparte}» no te debe nada.`,
      filtro,
    };
  }
  const [primera, ...resto] = deben.map((p) => ({ nombre: p.nombre, monto: pesos(p.saldo) }));
  const p = primera as { nombre: string; monto: string };
  const mas = resto.map((x) => `; ${x.nombre}, ${x.monto}`).join('');
  return { ...base, texto: `${p.nombre} te debe ${p.monto}${mas}.`, filtro };
}

/**
 * Responde una consulta con su plantilla. Lanza `consulta_no_soportada` para las que llegan con su hito
 * (`suscripciones` y `explicar` en M10; `puedo_retirar` e `impuestos` en M11; `deducciones` en M12).
 */
export function responderConsulta(ctx: Contexto, c: Consulta): RespuestaConsulta {
  if (!tienePlantilla(c.tipo)) {
    throw new ErrorDominio('consulta_no_soportada', 'esta consulta llega con su hito');
  }
  // Como al abrir Hoy: ocurrencias al día y cortes cerrados, para responder con el libro vigente.
  procesarApertura(ctx);
  switch (c.tipo) {
    case 'hoy_puedes':
      return hoyPuedes(ctx);
    case 'gasto_total':
    case 'gasto_por_categoria':
      return gastoTotal(ctx, c);
    case 'saldo':
      return saldo(ctx, c);
    case 'deuda_tarjetas':
      return deudaTarjetas(ctx);
    case 'compromisos':
      return compromisos(ctx, c);
    case 'por_cobrar':
      return porCobrar(ctx, c);
    case 'comparar_periodos':
      return compararPeriodos(ctx, c);
    case 'mayores_gastos':
      return mayoresGastos(ctx, c);
  }
}
