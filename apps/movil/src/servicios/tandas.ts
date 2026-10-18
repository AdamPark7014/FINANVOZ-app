import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  calendarioTanda,
  construirAportacionTanda,
  construirCobroTanda,
  diaSemana,
  ErrorDominio,
  esFecha,
  partes,
  proximasFechas,
  tandaExistente,
  type Centavos,
  type PlainDate,
  type Regla,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, insertarCuenta } from './catalogo';
import type { CoberturaAutomatica } from './cobertura';
import { enTransaccion, type Contexto } from './contexto';
import { etiquetaFecha } from './formato';
import { trasRegistrar } from './formulario';
import {
  listarOcurrencias,
  materializarOcurrencias,
  pospuestaHoy,
  type OcurrenciaVista,
} from './ocurrencias';
import { registrarSaldoInicial } from './onboarding';
import { escribirAjuste, leerAjuste } from './preferencias';
import { insertarProgramado, programadoPorId, validarRegla } from './programados';

const { tanda, ocurrencia, transaccion, asiento, programado, cuenta } = esquema;

/** "Cada cuándo" del formulario (`02 §18`); la regla sale de la primera fecha. */
export const FRECUENCIAS_TANDA = ['semanal', 'quincenal', 'catorcenal', 'mensual'] as const;
export type FrecuenciaTanda = (typeof FRECUENCIAS_TANDA)[number];

/** Regla de E3.1 para "cada semana / quincena / catorce días / mes" a partir de la primera fecha. */
export function reglaDeFrecuencia(frecuencia: FrecuenciaTanda, inicio: PlainDate): Regla {
  switch (frecuencia) {
    case 'semanal':
      return { tipo: 'semanal', dia_semana: diaSemana(inicio) };
    case 'quincenal':
      return { tipo: 'quincenal_15_ultimo' };
    case 'catorcenal':
      return { tipo: 'catorcenal', ancla: inicio };
    case 'mensual':
      return { tipo: 'mensual', dia: partes(inicio).dia };
  }
}

const Fecha = z.string().refine(esFecha, 'fecha inválida');

/** Formulario de tanda (`02 §18`): nombre, aportación, cada cuándo, participantes, tu turno y primera fecha. */
export const EntradaTanda = z
  .strictObject({
    nombre: z.string().trim().max(80).optional(),
    aportacion: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
    participantes: z.int().min(2).max(50),
    turno: z.int().min(1).max(50),
    regla: z.unknown(),
    inicio: Fecha,
    /** De dónde sale la aportación; `null` = la pregunta "Ya la di". */
    cuentaId: z.string().min(1).nullable().optional(),
    /** Tanda que ya empezó: lo que corrigió la persona sobre la propuesta (E11 `tandaExistente`). */
    aportacionesHechas: z.int().min(0).max(50).optional(),
    yaCobraste: z.boolean().optional(),
  })
  .refine((e) => e.turno <= e.participantes, { message: 'el turno no puede pasar de los participantes' })
  .refine((e) => e.aportacionesHechas === undefined || e.aportacionesHechas <= e.participantes, {
    message: 'no puedes llevar más aportaciones que rondas',
  });
export type EntradaTanda = Omit<z.input<typeof EntradaTanda>, 'regla'> & { regla: Regla };

const NOMBRE_POR_OMISION = 'Tanda';

/** Lo que ya pasó en una tanda que empezó antes de registrarla (E11-03, caso 23b). */
export interface TandaYaEmpezada {
  readonly aportacionesHechas: number;
  readonly yaCobraste: boolean;
  /** Saldo inicial de la cuenta de la tanda (positivo = te deben; negativo = debes). */
  readonly saldoInicial: Centavos;
  /** Aportaciones que faltan y lo que suman ("te faltan 4 ($2,000)"). */
  readonly faltan: number;
  readonly porAportar: Centavos;
}

/** Lo que se muestra antes de guardar (formulario o voz, TK01): calendario de E11 y, si ya empezó, la propuesta. */
export interface PropuestaTanda {
  readonly nombre: string;
  readonly aportacion: Centavos;
  readonly participantes: number;
  readonly turno: number;
  readonly regla: Regla;
  readonly inicio: PlainDate;
  readonly rondas: readonly PlainDate[];
  readonly fechaCobro: PlainDate;
  /** Lo que cobras: aportación × participantes. */
  readonly cobro: Centavos;
  /** `null` si la primera fecha es hoy o después. */
  readonly yaEmpezo: TandaYaEmpezada | null;
}

function validarEntrada(entrada: EntradaTanda) {
  const r = EntradaTanda.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('tanda_invalida', 'revisa los datos de la tanda');
  return { ...r.data, regla: validarRegla(r.data.regla), nombre: r.data.nombre || NOMBRE_POR_OMISION };
}

/** E11 sobre lo que dijo la persona: lo hecho y lo que falta en una tanda que ya empezó. */
function yaEmpezada(
  e: ReturnType<typeof validarEntrada>,
  hoy: PlainDate,
): { propuesta: TandaYaEmpezada | null; omitidas: readonly PlainDate[] } {
  const t = { aportacion: e.aportacion, participantes: e.participantes, turno: e.turno, regla: e.regla };
  const calendario = calendarioTanda({ ...t, inicio: e.inicio }, proximasFechas);
  if (e.inicio >= hoy && e.aportacionesHechas === undefined && e.yaCobraste === undefined) {
    return { propuesta: null, omitidas: [] };
  }
  const sugerida = tandaExistente({ ...t, inicio: e.inicio }, hoy, proximasFechas);
  const hechas = e.aportacionesHechas ?? sugerida.aportacionesHechas;
  const yaCobraste = e.yaCobraste ?? hechas >= e.turno;
  const aportado = e.aportacion * hechas;
  const cobro = e.aportacion * e.participantes;
  return {
    propuesta: {
      aportacionesHechas: hechas,
      yaCobraste,
      saldoInicial: aportado - (yaCobraste ? cobro : 0),
      faltan: e.participantes - hechas,
      porAportar: cobro - aportado,
    },
    // Las rondas ya aportadas no se vuelven a cobrar ni a apartar (`02 §18`).
    omitidas: calendario.rondas.slice(0, hechas),
  };
}

/**
 * Calendario y propuesta de una tanda antes de guardarla (`02 §18`). Si la primera fecha ya pasó, propone las
 * aportaciones vencidas y "ya cobraste" según tu turno (E11 `tandaExistente`); la persona puede corregirlas.
 */
export function proponerTanda(ctx: Contexto, entrada: EntradaTanda): PropuestaTanda {
  const e = validarEntrada(entrada);
  const c = calendarioTanda(
    {
      aportacion: e.aportacion,
      participantes: e.participantes,
      turno: e.turno,
      regla: e.regla,
      inicio: e.inicio,
    },
    proximasFechas,
  );
  return {
    nombre: e.nombre,
    aportacion: e.aportacion,
    participantes: e.participantes,
    turno: e.turno,
    regla: e.regla,
    inicio: e.inicio,
    rondas: c.rondas,
    fechaCobro: c.fechaCobro,
    cobro: e.aportacion * e.participantes,
    yaEmpezo: yaEmpezada(e, ctx.reloj.hoy()).propuesta,
  };
}

/**
 * TK01 ("entré a una tanda de 500 cada quincena, somos 10 y me toca el cuarto"): la propuesta para el formulario
 * prellenado. Sin primera fecha, la siguiente de la regla desde la fecha de la frase. `null` si no cuadra
 * (turno mayor que los participantes).
 */
export function proponerTandaPorVoz(
  ctx: Contexto,
  ajuste: {
    aportacion: Centavos;
    participantes: number;
    turno: number;
    regla: unknown;
    inicio?: string | undefined;
  },
  fecha: PlainDate,
): PropuestaTanda | null {
  try {
    const regla = validarRegla(ajuste.regla);
    const inicio = ajuste.inicio ?? proximasFechas(regla, fecha, 1)[0];
    if (!inicio) return null;
    return proponerTanda(ctx, {
      aportacion: ajuste.aportacion,
      participantes: ajuste.participantes,
      turno: ajuste.turno,
      regla,
      inicio,
    });
  } catch (error) {
    if (error instanceof ErrorDominio) return null;
    throw error;
  }
}

const Inicial = z.strictObject({ aportaciones: z.int().min(0), cobro: z.boolean() });
const claveInicial = (tandaId: string) => `tanda_inicial:${tandaId}`;

export interface TandaCreada {
  readonly tandaId: string;
  readonly cuentaId: string;
  readonly programadoId: string;
}

/**
 * Crea la tanda (`05 §E11`, `04 §3.2`) en una transacción SQLite: cuenta `contraparte:tanda`, programado de egreso
 * con la misma regla de `inicio` a la última ronda (sus ocurrencias son las aportaciones y E4 las aparta) y la
 * fila `tanda`. Si ya empezó: `saldo_inicial` contra `capital:saldos_iniciales` (caso 23b) y las rondas ya
 * aportadas como ocurrencias `omitida`.
 */
export function crearTanda(ctx: Contexto, entrada: EntradaTanda): TandaCreada {
  exigirConsentimiento(ctx);
  const e = validarEntrada(entrada);
  const hoy = ctx.reloj.hoy();
  const c = calendarioTanda(
    {
      aportacion: e.aportacion,
      participantes: e.participantes,
      turno: e.turno,
      regla: e.regla,
      inicio: e.inicio,
    },
    proximasFechas,
  );
  const { propuesta, omitidas } = yaEmpezada(e, hoy);
  if (e.cuentaId) {
    const origen = cuentaPorId(ctx, e.cuentaId);
    if (origen.liquida !== 1)
      throw new ErrorDominio('tanda_invalida', 'la aportación sale de una cuenta líquida');
  }
  return enTransaccion(ctx, () => {
    const cuentaId = insertarCuenta(ctx, { naturaleza: 'contraparte', subtipo: 'tanda', nombre: e.nombre });
    const programadoId = insertarProgramado(ctx, {
      tipo: 'egreso',
      concepto: e.nombre,
      monto: e.aportacion,
      regla: e.regla,
      desde: e.inicio,
      hasta: c.rondas[c.rondas.length - 1] as PlainDate,
      cuentaId: e.cuentaId ?? null,
      // Para E3.5 la "categoría" del programado es la tanda: la cubre un `aportacion_tanda` a esa tanda.
      categoriaCuentaId: cuentaId,
    });
    const tandaId = ctx.generarId();
    ctx.db
      .insert(tanda)
      .values({
        id: tandaId,
        cuentaId,
        nombre: e.nombre,
        aportacion: e.aportacion,
        participantes: e.participantes,
        turno: e.turno,
        regla: JSON.stringify(e.regla),
        inicio: e.inicio,
        programadoId,
      })
      .run();
    if (propuesta) {
      registrarSaldoInicial(ctx, cuentaId, propuesta.saldoInicial, hoy);
      for (const fecha of omitidas) {
        ctx.db
          .insert(ocurrencia)
          .values({ programadoId, fecha, estado: 'omitida' })
          .onConflictDoNothing()
          .run();
      }
      escribirAjuste(ctx, claveInicial(tandaId), Inicial, {
        aportaciones: propuesta.aportacionesHechas,
        cobro: propuesta.yaCobraste,
      });
    }
    materializarOcurrencias(ctx);
    return { tandaId, cuentaId, programadoId };
  });
}

type FilaTanda = typeof tanda.$inferSelect;

function filaTanda(ctx: Contexto, tandaId: string): FilaTanda {
  const f = ctx.db.select().from(tanda).where(eq(tanda.id, tandaId)).get();
  if (!f) throw new ErrorDominio('tanda_inexistente', 'esa tanda no existe');
  return f;
}

function exigirTandaActiva(t: FilaTanda): void {
  if (t.activa !== 1) throw new ErrorDominio('tanda_archivada', 'esa tanda está archivada');
}

/** Solo nombre y cuenta de aportación; el monto de la ronda no se edita. */
export const EditarTanda = z.strictObject({
  nombre: z.string().trim().min(1).max(80).optional(),
  cuentaId: z.string().min(1).nullable().optional(),
});
export type EditarTanda = z.input<typeof EditarTanda>;

function tandasActivas(ctx: Contexto): FilaTanda[] {
  return ctx.db
    .select()
    .from(tanda)
    .where(eq(tanda.activa, 1))
    .orderBy(asc(tanda.inicio), asc(tanda.id))
    .all();
}

/** Ocurrencias del programado de la tanda; si está archivada el programado ya no está activo. */
function ocurrenciasTanda(ctx: Contexto, t: FilaTanda): OcurrenciaVista[] {
  if (t.activa === 1) return listarOcurrencias(ctx, { programadoId: t.programadoId });
  const p = programadoPorId(ctx, t.programadoId);
  return ctx.db
    .select()
    .from(ocurrencia)
    .where(eq(ocurrencia.programadoId, t.programadoId))
    .orderBy(asc(ocurrencia.fecha))
    .all()
    .map((o) => ({
      programadoId: o.programadoId,
      fecha: o.fecha,
      estado: o.estado,
      tipo: p.tipo,
      concepto: p.concepto,
      monto: p.monto,
      cuentaId: p.cuentaId,
      categoriaCuentaId: p.categoriaCuentaId,
      tarjetaId: p.tarjetaId,
      variable: p.variable,
      defineHorizonte: p.defineHorizonte,
      transaccionId: o.transaccionId,
    }));
}

/** Ids de los programados que son aportaciones de una tanda (Hoy les pone su propia tarjeta). */
export function programadosDeTandas(ctx: Contexto): Set<string> {
  return new Set(
    ctx.db
      .select({ id: tanda.programadoId })
      .from(tanda)
      .all()
      .map((f) => f.id),
  );
}

/** Aportado y recibido según el libro: lo inicial (si ya había empezado) más aportaciones y cobros vigentes. */
function movimientosTanda(ctx: Contexto, t: FilaTanda) {
  const inicial = leerAjuste(ctx, claveInicial(t.id), Inicial) ?? { aportaciones: 0, cobro: false };
  const filas = ctx.db
    .select({ id: transaccion.id, tipo: transaccion.tipo, monto: asiento.monto })
    .from(asiento)
    .innerJoin(transaccion, eq(transaccion.id, asiento.transaccionId))
    .where(
      and(eq(asiento.cuentaId, t.cuentaId), inArray(transaccion.tipo, ['aportacion_tanda', 'cobro_tanda'])),
    )
    .all();
  const anuladas = new Set(
    filas.length === 0
      ? []
      : ctx.db
          .select({ id: transaccion.revierteA })
          .from(transaccion)
          .where(
            inArray(
              transaccion.revierteA,
              filas.map((f) => f.id),
            ),
          )
          .all()
          .map((f) => f.id),
  );
  let aportado = t.aportacion * inicial.aportaciones;
  let recibido = inicial.cobro ? t.aportacion * t.participantes : 0;
  let cobros = 0;
  for (const f of filas) {
    if (anuladas.has(f.id)) continue;
    if (f.tipo === 'aportacion_tanda') aportado += f.monto;
    else {
      recibido -= f.monto;
      cobros += 1;
    }
  }
  return { aportado, recibido, cobrada: inicial.cobro || cobros > 0 };
}

/** Una ronda del calendario de la tanda (`02 §18`). */
export interface RondaTandaVista {
  readonly t: number;
  readonly fecha: PlainDate;
  /** "vie 16" */
  readonly etiqueta: string;
  /** La ronda en que cobras (tu turno). */
  readonly esCobro: boolean;
  /** Estado de la aportación de esa ronda; `null` si todavía no se materializa (más de 90 días). */
  readonly estado: 'pendiente' | 'cubierta' | 'omitida' | null;
  /** E11 después de aportar esta ronda (y cobrar en tu turno). */
  readonly enRiesgo: Centavos;
  readonly porAportar: Centavos;
}

export interface TandaVista {
  readonly id: string;
  readonly nombre: string;
  readonly aportacion: Centavos;
  readonly participantes: number;
  readonly turno: number;
  readonly cobro: Centavos;
  readonly fechaCobro: PlainDate;
  readonly etiquetaCobro: string;
  readonly cobrada: boolean;
  /** Lo aportado y lo recibido según el libro. */
  readonly aportado: Centavos;
  readonly recibido: Centavos;
  /** `aportado − recibido` = saldo de la cuenta de la tanda (positivo = te deben; negativo = debes). */
  readonly posicion: Centavos;
  /** "Si la tanda se cae, arriesgas $1,500". */
  readonly enRiesgo: Centavos;
  /** "Te faltan $3,000 por aportar". */
  readonly porAportar: Centavos;
  readonly aportacionesHechas: number;
  /** Próxima aportación pendiente. */
  readonly proxima: { readonly fecha: PlainDate; readonly etiqueta: string } | null;
}

export interface DetalleTanda extends TandaVista {
  readonly activa: boolean;
  readonly rondas: readonly RondaTandaVista[];
  readonly cuentaId: string;
  /** Cuenta de donde sale la aportación, si la eligió. */
  readonly cuentaOrigenId: string | null;
}

function vistaTanda(ctx: Contexto, t: FilaTanda, ocurrencias: readonly OcurrenciaVista[]): TandaVista {
  const regla = validarRegla(JSON.parse(t.regla));
  const c = calendarioTanda(
    { aportacion: t.aportacion, participantes: t.participantes, turno: t.turno, regla, inicio: t.inicio },
    proximasFechas,
  );
  const { aportado, recibido, cobrada } = movimientosTanda(ctx, t);
  const posicion = aportado - recibido;
  const total = t.aportacion * t.participantes;
  const proxima = ocurrencias.find((o) => o.estado === 'pendiente');
  return {
    id: t.id,
    nombre: t.nombre,
    aportacion: t.aportacion,
    participantes: t.participantes,
    turno: t.turno,
    cobro: total,
    fechaCobro: c.fechaCobro,
    etiquetaCobro: etiquetaFecha(c.fechaCobro),
    cobrada,
    aportado,
    recibido,
    posicion,
    enRiesgo: Math.max(0, posicion),
    porAportar: Math.max(0, total - aportado),
    aportacionesHechas: Math.min(t.participantes, Math.floor(aportado / t.aportacion)),
    proxima: proxima ? { fecha: proxima.fecha, etiqueta: etiquetaFecha(proxima.fecha) } : null,
  };
}

/** Tandas activas, por fecha de inicio. */
export function listarTandas(ctx: Contexto): TandaVista[] {
  return tandasActivas(ctx).map((t) => vistaTanda(ctx, t, ocurrenciasTanda(ctx, t)));
}

/** Detalle (`02 §18`): calendario con tu ronda marcada, lo aportado, el dinero en riesgo y lo que falta. */
export function detalleTanda(ctx: Contexto, tandaId: string): DetalleTanda {
  const t = filaTanda(ctx, tandaId);
  const ocurrencias = ocurrenciasTanda(ctx, t);
  const regla = validarRegla(JSON.parse(t.regla));
  const c = calendarioTanda(
    { aportacion: t.aportacion, participantes: t.participantes, turno: t.turno, regla, inicio: t.inicio },
    proximasFechas,
  );
  const estado = new Map(ocurrencias.map((o) => [o.fecha, o.estado]));
  return {
    ...vistaTanda(ctx, t, ocurrencias),
    activa: t.activa === 1,
    cuentaId: t.cuentaId,
    cuentaOrigenId: programadoPorId(ctx, t.programadoId).cuentaId,
    rondas: c.posiciones.map((p) => ({
      t: p.t,
      fecha: p.fecha,
      etiqueta: etiquetaFecha(p.fecha),
      esCobro: p.t === t.turno,
      estado: estado.get(p.fecha) ?? null,
      enRiesgo: p.enRiesgo,
      porAportar: p.porAportar,
    })),
  };
}

/**
 * Archiva la tanda: deja de aparecer en la lista, desactiva el programado de aportaciones y marca como omitidas
 * las rondas pendientes (el historial en el libro no cambia).
 */
export function archivarTanda(ctx: Contexto, tandaId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const t = filaTanda(ctx, tandaId);
    if (t.activa !== 1) return;
    ctx.db.update(tanda).set({ activa: 0 }).where(eq(tanda.id, tandaId)).run();
    ctx.db.update(programado).set({ activo: 0 }).where(eq(programado.id, t.programadoId)).run();
    ctx.db
      .update(ocurrencia)
      .set({ estado: 'omitida' })
      .where(and(eq(ocurrencia.programadoId, t.programadoId), eq(ocurrencia.estado, 'pendiente')))
      .run();
  });
}

/** Cambia el nombre visible y la cuenta de donde sale la aportación (no el monto). */
export function editarTanda(ctx: Contexto, tandaId: string, cambios: EditarTanda): void {
  exigirConsentimiento(ctx);
  const parsed = EditarTanda.safeParse(cambios);
  if (!parsed.success) throw new ErrorDominio('tanda_invalida', 'revisa los datos de la tanda');
  const { nombre, cuentaId } = parsed.data;
  if (nombre === undefined && cuentaId === undefined) return;
  enTransaccion(ctx, () => {
    const t = filaTanda(ctx, tandaId);
    exigirTandaActiva(t);
    if (cuentaId !== undefined && cuentaId !== null) {
      const origen = cuentaPorId(ctx, cuentaId);
      if (origen.liquida !== 1)
        throw new ErrorDominio('tanda_invalida', 'la aportación sale de una cuenta líquida');
    }
    if (nombre !== undefined) {
      ctx.db.update(tanda).set({ nombre }).where(eq(tanda.id, tandaId)).run();
      ctx.db.update(cuenta).set({ nombre }).where(eq(cuenta.id, t.cuentaId)).run();
      ctx.db
        .update(programado)
        .set({ concepto: nombre })
        .where(eq(programado.id, t.programadoId))
        .run();
    }
    if (cuentaId !== undefined) {
      ctx.db
        .update(programado)
        .set({ cuentaId })
        .where(eq(programado.id, t.programadoId))
        .run();
    }
  });
}

export interface MovimientoTanda {
  readonly transaccionId: string;
  /** Token de "Deshacer". */
  readonly deshacer: string;
  readonly fecha: PlainDate;
  readonly tanda: string;
  readonly monto: Centavos;
  readonly cuenta: string;
  /** La aportación que cubrió (E3.5 o la ronda elegida). */
  readonly cobertura: CoberturaAutomatica | null;
}

function registrarEnTanda(
  ctx: Contexto,
  t: FilaTanda,
  tipo: 'aportacion_tanda' | 'cobro_tanda',
  e: {
    cuentaId: string;
    monto: Centavos;
    fecha: PlainDate;
    origen: 'manual' | 'voz' | 'texto';
    clave?: string;
  },
) {
  const m =
    tipo === 'aportacion_tanda'
      ? construirAportacionTanda({ tanda: t.cuentaId, origen: e.cuentaId, monto: e.monto })
      : construirCobroTanda({ tanda: t.cuentaId, destino: e.cuentaId, monto: e.monto });
  const { transaccion: tx } = ctx.libro.registrar({
    tipo: m.tipo,
    fecha: e.fecha,
    origen: e.origen,
    claveIdempotencia: e.clave ?? `mov:${ctx.generarId()}`,
    asientos: m.asientos,
    descripcion: t.nombre,
  });
  return tx.id;
}

function exigirCuenta(cuentaId: string | null | undefined, pregunta: string): string {
  if (!cuentaId) throw new ErrorDominio('cuenta_requerida', pregunta);
  return cuentaId;
}

/**
 * "Ya la di" (`02 §18`): registra `aportacion_tanda` (tanda + / líquida −, casos 9 y 23; no es gasto) y cubre la
 * ronda elegida; sin ronda, la cobertura automática (E3.5) busca la aportación pendiente. `cuentaId` es de dónde
 * salió (por omisión, la cuenta de la tanda).
 */
export function aportarTanda(
  ctx: Contexto,
  e: {
    tandaId: string;
    /** Ronda que cubre ("¿Ya diste tu tanda?" de Hoy). */
    fecha?: PlainDate;
    cuentaId?: string;
    monto?: Centavos;
    fechaPago?: PlainDate;
    origen?: 'manual' | 'voz' | 'texto';
    claveIdempotencia?: string;
  },
): MovimientoTanda {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const t = filaTanda(ctx, e.tandaId);
    exigirTandaActiva(t);
    const p = programadoPorId(ctx, t.programadoId);
    const cuentaId = exigirCuenta(e.cuentaId ?? p.cuentaId, '¿de qué cuenta salió?');
    if (e.fecha !== undefined) {
      const o = ctx.db
        .select()
        .from(ocurrencia)
        .where(and(eq(ocurrencia.programadoId, t.programadoId), eq(ocurrencia.fecha, e.fecha)))
        .get();
      if (!o) throw new ErrorDominio('ocurrencia_inexistente', 'esa ronda no existe');
      if (o.estado !== 'pendiente')
        throw new ErrorDominio('ocurrencia_resuelta', 'esa ronda ya está resuelta');
    }
    const monto = e.monto ?? t.aportacion;
    const fecha = e.fechaPago ?? ctx.reloj.hoy();
    const id = registrarEnTanda(ctx, t, 'aportacion_tanda', {
      cuentaId,
      monto,
      fecha,
      origen: e.origen ?? 'manual',
      ...(e.claveIdempotencia ? { clave: e.claveIdempotencia } : {}),
    });
    let cobertura: CoberturaAutomatica | null;
    if (e.fecha !== undefined) {
      ctx.db
        .update(ocurrencia)
        .set({ estado: 'cubierta', transaccionId: id })
        .where(and(eq(ocurrencia.programadoId, t.programadoId), eq(ocurrencia.fecha, e.fecha)))
        .run();
      cobertura = { decision: 'cubierta', programadoId: t.programadoId, fecha: e.fecha, concepto: t.nombre };
    } else {
      cobertura = trasRegistrar(ctx, id).cobertura;
    }
    return {
      transaccionId: id,
      deshacer: id,
      fecha,
      tanda: t.nombre,
      monto,
      cuenta: cuentaPorId(ctx, cuentaId).nombre,
      cobertura,
    };
  });
}

/**
 * "Me tocó la tanda" (`02 §18`): registra `cobro_tanda` (líquida + / tanda −). **No es ingreso**: es tu dinero de
 * vuelta, y el horizonte no se mueve. Por omisión cobra aportación × participantes.
 */
export function cobrarTanda(
  ctx: Contexto,
  e: {
    tandaId: string;
    cuentaId: string;
    monto?: Centavos;
    fecha?: PlainDate;
    origen?: 'manual' | 'voz' | 'texto';
    claveIdempotencia?: string;
  },
): MovimientoTanda {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const t = filaTanda(ctx, e.tandaId);
    exigirTandaActiva(t);
    const cuentaId = exigirCuenta(e.cuentaId, '¿a qué cuenta llegó?');
    const monto = e.monto ?? t.aportacion * t.participantes;
    const fecha = e.fecha ?? ctx.reloj.hoy();
    const id = registrarEnTanda(ctx, t, 'cobro_tanda', {
      cuentaId,
      monto,
      fecha,
      origen: e.origen ?? 'manual',
      ...(e.claveIdempotencia ? { clave: e.claveIdempotencia } : {}),
    });
    return {
      transaccionId: id,
      deshacer: id,
      fecha,
      tanda: t.nombre,
      monto,
      cuenta: cuentaPorId(ctx, cuentaId).nombre,
      cobertura: null,
    };
  });
}

/** La única tanda activa, para "di mi tanda" o "me tocó la tanda" por voz; `null` si hay cero o varias. */
export function tandaUnica(ctx: Contexto): string | null {
  const activas = tandasActivas(ctx);
  return activas.length === 1 ? (activas[0] as FilaTanda).id : null;
}

/** Tarjetas de Hoy de la tanda (`02 §18`). */
export type TarjetaTanda =
  | {
      /** El día de la aportación (o vencida): "¿Ya diste tu tanda?" (Ya la di · Todavía no). */
      readonly tipo: 'tanda_aportacion';
      readonly tandaId: string;
      readonly programadoId: string;
      readonly fecha: PlainDate;
      readonly etiquetaFecha: string;
      readonly nombre: string;
      readonly monto: Centavos;
      readonly cuando: 'hoy' | 'vencida';
      readonly pregunta: string;
      readonly opciones: readonly ['ya_la_di', 'todavia_no'];
    }
  | {
      /** Tu turno llegó y no has registrado el cobro: "Me tocó la tanda" (no es ingreso). */
      readonly tipo: 'tanda_cobro';
      readonly tandaId: string;
      readonly fecha: PlainDate;
      readonly etiquetaFecha: string;
      readonly nombre: string;
      readonly monto: Centavos;
      readonly pregunta: string;
      readonly opciones: readonly ['me_toco', 'todavia_no'];
    };

const Pospuesta = z.strictObject({ fecha: z.string() });
const claveCobroPospuesto = (tandaId: string) => `pospuesta_tanda_cobro:${tandaId}`;

/** "Todavía no" en "Me tocó la tanda": se oculta el resto del día y vuelve mañana. */
export function todaviaNoCobroTanda(ctx: Contexto, tandaId: string): void {
  exigirConsentimiento(ctx);
  filaTanda(ctx, tandaId);
  escribirAjuste(ctx, claveCobroPospuesto(tandaId), Pospuesta, { fecha: ctx.reloj.hoy() });
}

/** Tarjetas de la tanda para Hoy: aportaciones que tocan hoy o ya vencieron y el cobro de tu turno. */
export function tarjetasTanda(ctx: Contexto, pendientes: readonly OcurrenciaVista[]): TarjetaTanda[] {
  const hoy = ctx.reloj.hoy();
  const activas = tandasActivas(ctx);
  if (activas.length === 0) return [];
  const porProgramado = new Map(activas.map((t) => [t.programadoId, t]));
  const salida: TarjetaTanda[] = [];
  for (const o of pendientes) {
    const t = porProgramado.get(o.programadoId);
    if (!t || o.fecha > hoy || pospuestaHoy(ctx, o)) continue;
    salida.push({
      tipo: 'tanda_aportacion',
      tandaId: t.id,
      programadoId: o.programadoId,
      fecha: o.fecha,
      etiquetaFecha: etiquetaFecha(o.fecha),
      nombre: t.nombre,
      monto: o.monto,
      cuando: o.fecha === hoy ? 'hoy' : 'vencida',
      pregunta: '¿Ya diste tu tanda?',
      opciones: ['ya_la_di', 'todavia_no'],
    });
  }
  for (const t of activas) {
    const v = vistaTanda(ctx, t, []);
    if (v.cobrada || v.fechaCobro > hoy) continue;
    if (leerAjuste(ctx, claveCobroPospuesto(t.id), Pospuesta)?.fecha === hoy) continue;
    salida.push({
      tipo: 'tanda_cobro',
      tandaId: t.id,
      fecha: v.fechaCobro,
      etiquetaFecha: v.etiquetaCobro,
      nombre: t.nombre,
      monto: v.cobro,
      pregunta:
        v.fechaCobro === hoy
          ? 'Hoy te toca cobrar tu tanda.'
          : `Te tocaba cobrar tu tanda el ${v.etiquetaCobro}.`,
      opciones: ['me_toco', 'todavia_no'],
    });
  }
  return salida;
}
