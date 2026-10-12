import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  CATALOGO_SUSCRIPCIONES,
  detectarSuscripciones,
  ErrorDominio,
  normalizarComercio,
  partes,
  resumenActivas,
  sumarDias,
  VENTANA_SUSCRIPCIONES_DIAS,
  type Centavos,
  type GastoSuscripcion,
  type Periodicidad,
  type PlainDate,
  type Suscripcion,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { enTransaccion, type Contexto } from './contexto';
import { etiquetaDiaMes, etiquetaFecha, miles, pesos } from './formato';
import { materializarOcurrencias } from './ocurrencias';
import { escribirAjuste, leerAjuste } from './preferencias';
import { insertarProgramado } from './programados';

const { asiento, cuenta, suscripcion, transaccionVigente: tv } = esquema;

/**
 * Suscripciones (M10, RF-INT-01, `02 §20`, `05 §E14`): E14 sobre los gastos con comercio de los últimos 400
 * días, su estado en la tabla `suscripcion` (`detectada` · `compromiso` · `ignorada`) y "Convertir en
 * compromiso". Nada de esto va a logs (regla 9): ni comercios ni montos.
 */

type EstadoTabla = 'detectada' | 'compromiso' | 'ignorada';

/** Catálogo semilla de E14: el del contexto (pruebas de CA-M10-01 con el de E14-01) o el de `07 §6`. */
function catalogoDe(ctx: Contexto): readonly string[] {
  return ctx.catalogoSuscripciones ?? CATALOGO_SUSCRIPCIONES;
}

/**
 * Gastos vigentes del espacio personal con comercio en la ventana de E14. El monto es lo que fue a cuentas de
 * gasto (Σ asientos positivos de naturaleza `gasto`). Solo cuenta el comercio capturado o dictado, no la
 * descripción ("tacos" cada semana no es una suscripción).
 */
function gastosConComercio(
  ctx: Contexto,
  hoy: PlainDate,
): (GastoSuscripcion & { categoriaCuentaId: string })[] {
  const filas = ctx.db
    .select({
      id: tv.id,
      fecha: tv.fecha,
      comercio: tv.comercio,
      cuentaId: asiento.cuentaId,
      monto: asiento.monto,
    })
    .from(asiento)
    .innerJoin(tv, eq(tv.id, asiento.transaccionId))
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(
      and(
        eq(tv.tipo, 'gasto'),
        isNotNull(tv.comercio),
        eq(cuenta.naturaleza, 'gasto'),
        eq(cuenta.espacio, 'personal'),
        gte(tv.fecha, sumarDias(hoy, -VENTANA_SUSCRIPCIONES_DIAS)),
        lte(tv.fecha, hoy),
      ),
    )
    .all();
  const porTransaccion = new Map<
    string,
    { fecha: PlainDate; comercio: string | null; monto: number; categoriaCuentaId: string }
  >();
  for (const f of filas) {
    const t = porTransaccion.get(f.id);
    if (t) t.monto += f.monto;
    else
      porTransaccion.set(f.id, {
        fecha: f.fecha,
        comercio: f.comercio,
        monto: f.monto,
        categoriaCuentaId: f.cuentaId,
      });
  }
  return [...porTransaccion.values()].filter((g) => g.monto > 0);
}

const NoEsSuscripcion = z.array(z.string());
/** Comercios marcados "No es suscripción": no vuelven a aparecer aunque se cobren otra vez. */
const CLAVE_NO_ES = 'suscripciones:no_es';
/** Fecha de la última detección de la tarea diaria. */
const CLAVE_ULTIMA = 'suscripciones:ultima_deteccion';

function noEsSuscripcion(ctx: Contexto): ReadonlySet<string> {
  return new Set(leerAjuste(ctx, CLAVE_NO_ES, NoEsSuscripcion) ?? []);
}

function filasTabla(ctx: Contexto): Map<string, typeof suscripcion.$inferSelect> {
  return new Map(
    ctx.db
      .select()
      .from(suscripcion)
      .all()
      .map((f) => [f.comercioNormalizado, f]),
  );
}

/**
 * E14 y la tabla `suscripcion` al día: alta de las nuevas (`detectada`), monto típico y último cargo de las
 * conocidas, y una `ignorada` ("Ya la cancelé") que vuelve a cobrarse reaparece como `detectada` (`02 §20`).
 * Idempotente. Devuelve lo que detectó E14.
 */
export function procesarSuscripciones(ctx: Contexto): Suscripcion[] {
  const hoy = ctx.reloj.hoy();
  const detectadas = detectarSuscripciones(gastosConComercio(ctx, hoy), hoy, catalogoDe(ctx));
  const descartadas = noEsSuscripcion(ctx);
  enTransaccion(ctx, () => {
    const tabla = filasTabla(ctx);
    for (const s of detectadas) {
      if (descartadas.has(s.comercio)) continue;
      const previa = tabla.get(s.comercio);
      const datos = {
        periodicidad: s.periodicidad,
        montoTipico: s.monto_tipico,
        ultimoCargo: s.ultimo_cargo,
        actualizadaEn: ctx.reloj.ahora(),
      };
      if (!previa) {
        ctx.db
          .insert(suscripcion)
          .values({ comercioNormalizado: s.comercio, estado: 'detectada', ...datos })
          .run();
        continue;
      }
      if (previa.ultimoCargo === s.ultimo_cargo && previa.montoTipico === s.monto_tipico) continue;
      const reaparece = previa.estado === 'ignorada' && s.ultimo_cargo > previa.ultimoCargo;
      ctx.db
        .update(suscripcion)
        .set({ ...datos, ...(reaparece ? { estado: 'detectada' as const } : {}) })
        .where(eq(suscripcion.comercioNormalizado, s.comercio))
        .run();
    }
  });
  return detectadas;
}

/**
 * Tarea diaria (`03 §7`: "E14 corre en la tarea diaria, no al abrir Hoy"): corre E14 a lo más una vez por día
 * civil. La llama `procesarApertura` (la primera apertura del día) y la tarea en segundo plano.
 */
export function procesarSuscripcionesDelDia(ctx: Contexto): boolean {
  const hoy = ctx.reloj.hoy();
  if (leerAjuste(ctx, CLAVE_ULTIMA, z.string()) === hoy) return false;
  procesarSuscripciones(ctx);
  escribirAjuste(ctx, CLAVE_ULTIMA, z.string(), hoy);
  return true;
}

// ——— Vista ———

export interface SuscripcionVista {
  readonly comercio: string;
  /** "Estudio Yoga" (el comercio normalizado con mayúscula inicial). */
  readonly nombre: string;
  readonly periodicidad: Periodicidad;
  readonly monto: Centavos;
  readonly montoAnterior: Centavos | null;
  readonly costoAnual: Centavos;
  readonly ultimoCargo: PlainDate;
  readonly proximoCargo: PlainDate | null;
  readonly activa: boolean;
  /** Ya es compromiso: Hoy la aparta. */
  readonly compromiso: boolean;
  readonly programadoId: string | null;
  /** "$150 cada semana" · "$599 al mes" · "$350 al año". */
  readonly textoMonto: string;
  /** "antes $115" con un aumento de precio. */
  readonly textoAntes: string | null;
  /** "próximo vie 16 oct" · "próximo 1 nov" · "próximo 8 oct 2027". */
  readonly textoProximo: string | null;
}

export interface VistaSuscripciones {
  readonly activas: readonly SuscripcionVista[];
  readonly inactivas: readonly SuscripcionVista[];
  readonly cantidad: number;
  readonly costoAnual: Centavos;
  /** `piso(Σ costo anual de las activas / 12)` (`E14-01.resumen_activas`). */
  readonly mensual: Centavos;
  /** "Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)"; `null` sin activas. */
  readonly textoResumen: string | null;
  /** "Ya no se cobran: Disney Plus (último cargo 20 jul)"; `null` sin inactivas. */
  readonly textoInactivas: string | null;
}

const CADA: Record<Periodicidad, string> = { mensual: 'al mes', semanal: 'cada semana', anual: 'al año' };

/** Pesos sin centavos, hacia abajo: "unos $1,626". */
const pesosPiso = (c: Centavos) => `$${miles(Math.floor(c / 100))}`;

function nombreDe(comercio: string): string {
  return comercio
    .toLowerCase()
    .split(' ')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function textoProximo(p: Periodicidad, fecha: PlainDate, hoy: PlainDate): string {
  if (p === 'semanal') return `próximo ${etiquetaFecha(fecha)} ${etiquetaDiaMes(fecha).split(' ')[1]}`;
  const anio = partes(fecha).anio;
  return `próximo ${etiquetaDiaMes(fecha)}${anio === partes(hoy).anio ? '' : ` ${anio}`}`;
}

function vista(
  s: Suscripcion,
  fila: typeof suscripcion.$inferSelect | undefined,
  hoy: PlainDate,
): SuscripcionVista {
  const compromiso = fila?.estado === 'compromiso';
  return {
    comercio: s.comercio,
    nombre: nombreDe(s.comercio),
    periodicidad: s.periodicidad,
    monto: s.monto_tipico,
    montoAnterior: s.monto_anterior,
    costoAnual: s.costo_anual,
    ultimoCargo: s.ultimo_cargo,
    proximoCargo: s.proximo_cargo,
    activa: s.estado === 'activa',
    compromiso,
    programadoId: compromiso ? (fila?.programadoId ?? null) : null,
    textoMonto: `${pesos(s.monto_tipico)} ${CADA[s.periodicidad]}`,
    textoAntes: s.monto_anterior === null ? null : `antes ${pesos(s.monto_anterior)}`,
    textoProximo: s.proximo_cargo === null ? null : textoProximo(s.periodicidad, s.proximo_cargo, hoy),
  };
}

const plural = (n: number) => (n === 1 ? '1 suscripción' : `${n} suscripciones`);

/**
 * Cuentas → Suscripciones (`02 §20`, Gratis): corre E14 (es una pantalla que se abre a propósito, no Hoy) y
 * arma las activas, las que ya no se cobran y el resumen. Las ignoradas no aparecen.
 */
export function listarSuscripciones(ctx: Contexto): VistaSuscripciones {
  const hoy = ctx.reloj.hoy();
  const detectadas = procesarSuscripciones(ctx);
  const tabla = filasTabla(ctx);
  const descartadas = noEsSuscripcion(ctx);
  const visibles = detectadas.filter(
    (s) => !descartadas.has(s.comercio) && tabla.get(s.comercio)?.estado !== 'ignorada',
  );
  const r = resumenActivas(visibles);
  const activas = visibles
    .filter((s) => s.estado === 'activa')
    .map((s) => vista(s, tabla.get(s.comercio), hoy));
  const inactivas = visibles
    .filter((s) => s.estado !== 'activa')
    .map((s) => vista(s, tabla.get(s.comercio), hoy));
  return {
    activas,
    inactivas,
    cantidad: r.cantidad,
    costoAnual: r.costo_anual,
    mensual: r.mensual,
    textoResumen:
      r.cantidad === 0
        ? null
        : `Pagas unos ${pesosPiso(r.mensual)} al mes en ${plural(r.cantidad)} (${pesosPiso(r.costo_anual)} al año)`,
    textoInactivas:
      inactivas.length === 0
        ? null
        : `Ya no se cobran: ${inactivas.map((s) => `${s.nombre} (último cargo ${etiquetaDiaMes(s.ultimoCargo)})`).join(', ')}`,
  };
}

// ——— Acciones ———

function exigirVisible(
  ctx: Contexto,
  comercio: string,
): { s: Suscripcion; fila: typeof suscripcion.$inferSelect } {
  const s = procesarSuscripciones(ctx).find((x) => x.comercio === comercio);
  const fila = filasTabla(ctx).get(comercio);
  if (!s || !fila || noEsSuscripcion(ctx).has(comercio) || fila.estado === 'ignorada') {
    throw new ErrorDominio('suscripcion_inexistente', 'esa suscripción ya no está en la lista');
  }
  return { s, fila };
}

/** La categoría del último cargo de la serie (para que E3.5 cubra también por categoría). */
function categoriaDelUltimoCargo(ctx: Contexto, s: Suscripcion): string | null {
  const g = gastosConComercio(ctx, ctx.reloj.hoy()).find(
    (x) => x.fecha === s.ultimo_cargo && normalizarComercio(x.comercio) === s.comercio,
  );
  return g?.categoriaCuentaId ?? null;
}

/**
 * "Convertir en compromiso" (`02 §20`, `05 §E14` Uso): crea el programado de egreso con la regla de E14
 * (mensual con el mayor día sin acotar, semanal con el día del último cargo o anual con su mes y día), el monto
 * típico, el comercio normalizado y la categoría del último cargo, desde el día siguiente al último cargo; lo
 * materializa para que E4 aparte el próximo cargo si cae en el horizonte. El cargo real cubre la ocurrencia por
 * comercio o categoría (E3.5). Solo para activas que todavía no son compromiso.
 */
export function convertirEnCompromiso(ctx: Contexto, comercio: string): { programadoId: string } {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const { s, fila } = exigirVisible(ctx, comercio);
    if (fila.estado === 'compromiso') {
      throw new ErrorDominio('suscripcion_ya_compromiso', 'esa suscripción ya es un compromiso');
    }
    if (s.estado !== 'activa') {
      throw new ErrorDominio('suscripcion_inactiva', 'esa suscripción ya no se cobra');
    }
    const programadoId = insertarProgramado(ctx, {
      tipo: 'egreso',
      concepto: nombreDe(s.comercio),
      monto: s.monto_tipico,
      regla: s.regla,
      desde: sumarDias(s.ultimo_cargo, 1),
      categoriaCuentaId: categoriaDelUltimoCargo(ctx, s),
      comercioNormalizado: s.comercio,
    });
    ctx.db
      .update(suscripcion)
      .set({ estado: 'compromiso' satisfies EstadoTabla, programadoId, actualizadaEn: ctx.reloj.ahora() })
      .where(eq(suscripcion.comercioNormalizado, comercio))
      .run();
    materializarOcurrencias(ctx);
    return { programadoId };
  });
}

/** "Ya la cancelé": se oculta; si vuelve a cobrarse (un cargo posterior), reaparece. */
export function yaLaCancele(ctx: Contexto, comercio: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const { fila } = exigirVisible(ctx, comercio);
    if (fila.estado === 'compromiso') {
      throw new ErrorDominio('suscripcion_ya_compromiso', 'esa suscripción ya es un compromiso');
    }
    ctx.db
      .update(suscripcion)
      .set({ estado: 'ignorada' satisfies EstadoTabla, actualizadaEn: ctx.reloj.ahora() })
      .where(eq(suscripcion.comercioNormalizado, comercio))
      .run();
  });
}

/** "No es suscripción": se oculta para siempre (aunque vuelva a cobrarse). */
export function marcarNoEsSuscripcion(ctx: Contexto, comercio: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const { fila } = exigirVisible(ctx, comercio);
    if (fila.estado === 'compromiso') {
      throw new ErrorDominio('suscripcion_ya_compromiso', 'esa suscripción ya es un compromiso');
    }
    ctx.db
      .update(suscripcion)
      .set({ estado: 'ignorada' satisfies EstadoTabla, actualizadaEn: ctx.reloj.ahora() })
      .where(eq(suscripcion.comercioNormalizado, comercio))
      .run();
    const actuales = leerAjuste(ctx, CLAVE_NO_ES, NoEsSuscripcion) ?? [];
    escribirAjuste(ctx, CLAVE_NO_ES, NoEsSuscripcion, [...new Set([...actuales, comercio])].sort());
  });
}

/** Q12 · "¿qué suscripciones tengo?" (`06 §6`): la frase del resumen y una línea por activa. */
export function resumenParaConsulta(ctx: Contexto): {
  texto: string;
  lineas: { etiqueta: string; valor: string }[];
} {
  const v = listarSuscripciones(ctx);
  if (v.cantidad === 0) return { texto: 'No encontré suscripciones en tus gastos.', lineas: [] };
  return {
    texto: `Pagas unos ${pesosPiso(v.mensual)} al mes en ${plural(v.cantidad)}.`,
    lineas: v.activas.map((s) => ({
      etiqueta: s.textoProximo ? `${s.nombre} · ${s.textoProximo}` : s.nombre,
      valor: s.textoAntes ? `${s.textoMonto} (${s.textoAntes})` : s.textoMonto,
    })),
  };
}
