import { and, eq } from 'drizzle-orm';
import { ErrorDominio, minFecha, sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import { CUENTAS_SISTEMA, esquema, type TransaccionNueva } from '@cartera/datos';
import { normalizarAlias, type Ajuste } from '@cartera/nlu';
import type { EventoAnalitica } from '../analitica/eventos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { aprenderAlias, aprenderCategoria } from './aprendizaje';
import { cuentaPorId, idCategoriaDe } from './catalogo';
import { cubrirAutomaticamente, liberarOcurrencias } from './cobertura';
import { exigirNoCompartido } from './formulario';
import { restaurarPlanDe } from './msi';
import { enTransaccion, type Contexto } from './contexto';
import { anularMovimiento } from './formulario';
import { listarMovimientos, type MovimientoVista } from './movimientos';
import { materializarOcurrencias } from './ocurrencias';
import { proximoPago } from './onboarding';
import { insertarProgramado, validarRegla } from './programados';

const { transaccion, asiento, cuenta, ocurrencia, programado, planMsi } = esquema;

/** Ventana de búsqueda del objetivo de una corrección o anulación (`06 §7`). */
export const DIAS_BUSQUEDA = 30;
/** Una sola coincidencia registrada en las últimas 48 h se aplica directo con "Deshacer" (`06 §7`). */
export const VENTANA_DIRECTA_MS = 48 * 60 * 60 * 1000;

/** Lo que dijo la persona para señalar un movimiento (`Referencia` de `06 §3`). */
export interface ReferenciaMovimiento {
  readonly ultimo?: boolean | undefined;
  readonly texto?: string | undefined;
  readonly fecha?: PlainDate | undefined;
  readonly monto?: Centavos | undefined;
}

const normal = (s: string | null | undefined) => normalizarAlias(s ?? '');

function coincideTexto(m: MovimientoVista, texto: string): boolean {
  const buscado = normal(texto);
  if (buscado === '') return true;
  return [m.descripcion, m.comercio, m.categoria].some((campo) => {
    const t = normal(campo);
    return t !== '' && (t.includes(buscado) || buscado.includes(t));
  });
}

/**
 * Movimientos vigentes de los últimos 30 días que coinciden con la referencia: texto contenido en descripción,
 * comercio o categoría; monto y fecha si vienen; `ultimo` = el más reciente por `registrada_en`. Ordenados del
 * más reciente al más antiguo.
 */
export function buscarMovimientos(
  ctx: Contexto,
  ref: ReferenciaMovimiento,
  hoy: PlainDate,
): MovimientoVista[] {
  const candidatos = listarMovimientos(ctx, { desde: sumarDias(hoy, -DIAS_BUSQUEDA), hasta: hoy })
    .flatMap((d) => d.movimientos)
    .filter((m) => m.tipo !== 'ajuste_arqueo')
    .filter((m) => ref.texto === undefined || coincideTexto(m, ref.texto))
    .filter((m) => ref.monto === undefined || m.monto === ref.monto)
    .filter((m) => ref.fecha === undefined || m.fecha === ref.fecha)
    .sort((a, b) => b.registradaEn - a.registradaEn);
  if (ref.ultimo && candidatos[0]) return [candidatos[0]];
  return candidatos;
}

/** `true` si se puede aplicar sin preguntar: una sola coincidencia registrada hace menos de 48 h. */
export function aplicaDirecto(ctx: Contexto, candidatos: readonly MovimientoVista[]): boolean {
  const [unico] = candidatos;
  return candidatos.length === 1 && !!unico && ctx.reloj.ahora() - unico.registradaEn <= VENTANA_DIRECTA_MS;
}

// ——— Resumen de una transacción ———

export interface ResumenTransaccion {
  readonly transaccionId: string;
  readonly tipo: string;
  readonly fecha: PlainDate;
  readonly descripcion: string | null;
  readonly monto: Centavos;
  readonly categoria: string | null;
  readonly cuenta: string;
  readonly porAsignar: boolean;
}

interface Leida {
  readonly fila: typeof transaccion.$inferSelect;
  readonly asientos: {
    cuentaId: string;
    monto: Centavos;
    naturaleza: string;
    subtipo: string;
    nombre: string;
  }[];
}

function leer(ctx: Contexto, id: string): Leida {
  const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, id)).get();
  if (!fila) throw new ErrorDominio('transaccion_inexistente', 'no existe ese movimiento');
  const asientos = ctx.db
    .select({
      cuentaId: asiento.cuentaId,
      monto: asiento.monto,
      naturaleza: cuenta.naturaleza,
      subtipo: cuenta.subtipo,
      nombre: cuenta.nombre,
    })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(eq(asiento.transaccionId, id))
    .all();
  return { fila, asientos };
}

const esCategoria = (naturaleza: string) => naturaleza === 'gasto' || naturaleza === 'ingreso';
const PUENTES = new Set<string>([CUENTAS_SISTEMA.porAsignar, CUENTAS_SISTEMA.porAsignarEntradas]);

export function resumenTransaccion(ctx: Contexto, id: string): ResumenTransaccion {
  const { fila, asientos } = leer(ctx, id);
  const categoria = asientos.find((a) => esCategoria(a.naturaleza));
  const propia = categoria
    ? asientos.find((a) => a !== categoria)
    : (asientos.find((a) => a.monto < 0) ?? asientos[0]);
  return {
    transaccionId: id,
    tipo: fila.tipo,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    monto: asientos.reduce((s, a) => s + Math.max(0, a.monto), 0),
    categoria: categoria?.nombre ?? null,
    cuenta: propia?.nombre ?? '',
    porAsignar: asientos.some((a) => PUENTES.has(a.cuentaId)),
  };
}

/** Una versión anterior de un movimiento corregido, con el momento en que se cambió. */
export interface VersionAnterior extends ResumenTransaccion {
  /** `registrada_en` de la versión que la reemplazó (ms). */
  readonly cambiadaEn: number;
}

/**
 * Historial de un movimiento corregido (CA-M3-03): sus versiones anteriores siguiendo `reemplaza_a`, de la más
 * reciente a la original. Vacío si nunca se corrigió.
 */
export function historialMovimiento(ctx: Contexto, transaccionId: string): VersionAnterior[] {
  const versiones: VersionAnterior[] = [];
  const vistos = new Set<string>();
  let actual = ctx.db.select().from(transaccion).where(eq(transaccion.id, transaccionId)).get();
  while (actual?.reemplazaA && !vistos.has(actual.reemplazaA)) {
    vistos.add(actual.reemplazaA);
    versiones.push({ ...resumenTransaccion(ctx, actual.reemplazaA), cambiadaEn: actual.registradaEn });
    actual = ctx.db.select().from(transaccion).where(eq(transaccion.id, actual.reemplazaA)).get();
  }
  return versiones;
}

function estaAnulada(ctx: Contexto, id: string): boolean {
  return !!ctx.db.select({ id: transaccion.id }).from(transaccion).where(eq(transaccion.revierteA, id)).get();
}

// ——— Corregir ———

/** Cambios ya resueltos a ids y slugs (la cuenta la resolvió el resolutor o la eligió la persona). */
export interface CambiosResueltos {
  readonly monto?: Centavos | undefined;
  readonly fecha?: PlainDate | undefined;
  readonly categoria?: string | undefined;
  readonly origenId?: string | undefined;
  readonly descripcion?: string | undefined;
  /** Alias que dijo la persona para la cuenta nueva: se aprende (`06 §12`). */
  readonly aliasDicho?: string | null | undefined;
}

export interface ResultadoCorreccion {
  readonly antes: ResumenTransaccion;
  readonly despues: ResumenTransaccion;
  /** Token de "Deshacer". */
  readonly deshacer: string;
}

export type OrigenCorreccion = 'voz' | 'texto' | 'manual';

/** Valores de `correccion.campo` en la lista blanca (`03 §8`). */
export type CampoCorreccionAnalitica = Extract<
  EventoAnalitica,
  { nombre: 'correccion' }
>['propiedades']['campo'];

/** Qué campos del catálogo cambió una corrección (sin alias ni textos libres). */
export function camposCorreccionAnalitica(cambios: CambiosResueltos): readonly CampoCorreccionAnalitica[] {
  const campos: CampoCorreccionAnalitica[] = [];
  if (cambios.monto !== undefined) campos.push('monto');
  if (cambios.fecha !== undefined) campos.push('fecha');
  if (cambios.categoria !== undefined) campos.push('categoria');
  if (cambios.origenId !== undefined) campos.push('cuenta');
  if (cambios.descripcion !== undefined) campos.push('descripcion');
  return campos;
}

let registrarEventoCorreccion: ((evento: EventoAnalitica) => void) | null = null;

/** Enlaza la analítica opt-in al aplicar correcciones (voz/texto); la pantalla de registro lo monta una vez. */
export function enlaceAnaliticaCorreccion(registrar: ((evento: EventoAnalitica) => void) | null): void {
  registrarEventoCorreccion = registrar;
}

function notificarCorreccionAnalitica(
  registrar: ((evento: EventoAnalitica) => void) | undefined,
  cambios: CambiosResueltos,
): void {
  const emitir = registrar ?? registrarEventoCorreccion;
  if (!emitir) return;
  for (const campo of camposCorreccionAnalitica(cambios)) {
    try {
      emitir({ nombre: 'correccion', propiedades: { campo } });
    } catch {
      // La analítica nunca debe romper una corrección.
    }
  }
}

/**
 * Corrige un movimiento (RF-REG-06): `Libro.reemplazar` anula la original con su transacción espejo y registra
 * la versión corregida con `reemplaza_a` (regla 2). Conserva tipo, descripción y comercio salvo lo que cambia.
 * Corregir la cuenta aprende el alias dicho y corregir la categoría aprende la regla del comercio (`06 §12`).
 */
export function aplicarCorreccion(
  ctx: Contexto,
  transaccionId: string,
  cambios: CambiosResueltos,
  opciones: {
    origen?: OrigenCorreccion;
    claveIdempotencia?: string;
    /** Si viene, emite `correccion {campo}` por cada campo cambiado (misma forma que captura). */
    registrarEvento?: (evento: EventoAnalitica) => void;
  } = {},
): ResultadoCorreccion {
  exigirConsentimiento(ctx);
  const resultado = enTransaccion(ctx, () => {
    if (estaAnulada(ctx, transaccionId)) throw new ErrorDominio('ya_anulada', 'ese movimiento ya no está');
    exigirNoCompartido(ctx, transaccionId);
    const antes = resumenTransaccion(ctx, transaccionId);
    const { fila, asientos } = leer(ctx, transaccionId);
    if (asientos.length !== 2) {
      throw new ErrorDominio('correccion_no_soportada', 'ese movimiento no se puede corregir así');
    }
    const categoria = asientos.find((a) => esCategoria(a.naturaleza));
    // Una compra a meses solo cambia de categoría o descripción: el monto, la fecha y la tarjeta son del plan.
    const esMsi = fila.tipo === 'compra_msi';
    if (
      esMsi &&
      (cambios.monto !== undefined || cambios.fecha !== undefined || cambios.origenId !== undefined)
    ) {
      throw new ErrorDominio(
        'correccion_no_soportada',
        'una compra a meses solo cambia de categoría o descripción',
      );
    }
    const nuevos = asientos.map((a) => ({ cuentaId: a.cuentaId, monto: a.monto }));
    if (cambios.monto !== undefined) {
      if (!Number.isSafeInteger(cambios.monto) || cambios.monto <= 0) {
        throw new ErrorDominio('monto_invalido', 'el monto debe ser mayor que cero');
      }
      for (const a of nuevos) a.monto = Math.sign(a.monto) * (cambios.monto as number);
    }
    let categoriaNueva: string | null = null;
    if (cambios.categoria !== undefined) {
      if (!categoria) throw new ErrorDominio('correccion_no_soportada', 'ese movimiento no tiene categoría');
      categoriaNueva = idCategoriaDe(ctx, cambios.categoria, categoria.naturaleza as 'gasto' | 'ingreso');
      const i = asientos.indexOf(categoria);
      (nuevos[i] as { cuentaId: string }).cuentaId = categoriaNueva;
    }
    if (cambios.origenId !== undefined) {
      const i = asientos.findIndex((a) => a.monto < 0 && !esCategoria(a.naturaleza));
      if (i < 0) throw new ErrorDominio('correccion_no_soportada', 'ese movimiento no sale de una cuenta');
      (nuevos[i] as { cuentaId: string }).cuentaId = cambios.origenId;
    }
    const nueva: TransaccionNueva = {
      tipo: fila.tipo as TransaccionNueva['tipo'],
      fecha: cambios.fecha ?? fila.fecha,
      origen: opciones.origen ?? 'manual',
      claveIdempotencia: opciones.claveIdempotencia ?? `corr:${ctx.generarId()}`,
      asientos: nuevos,
      descripcion: cambios.descripcion ?? fila.descripcion,
      comercio: fila.comercio,
      estimada: fila.estimada === 1,
      extraordinaria: fila.extraordinaria === 1,
      porRevisar: false,
      meta: fila.meta,
    };
    const r = ctx.libro.reemplazar(transaccionId, nueva);
    if (esMsi) {
      // El plan sigue siendo el mismo: apunta a la versión corregida de su compra.
      ctx.db
        .update(planMsi)
        .set({ transaccionAltaId: r.nueva.id })
        .where(eq(planMsi.transaccionAltaId, transaccionId))
        .run();
    }
    liberarOcurrencias(ctx, transaccionId);
    cubrirAutomaticamente(ctx, r.nueva.id);
    if (cambios.origenId !== undefined) aprenderAlias(ctx, cambios.aliasDicho, cambios.origenId);
    if (categoriaNueva) aprenderCategoria(ctx, fila.comercio, fila.descripcion, categoriaNueva);
    return {
      antes,
      despues: resumenTransaccion(ctx, r.nueva.id),
      deshacer: `r:${r.nueva.id}:${transaccionId}`,
    };
  });
  notificarCorreccionAnalitica(opciones.registrarEvento, cambios);
  return resultado;
}

/** Asientos y datos de `id` como transacción nueva (para restaurar lo anulado o corregido). */
function copia(ctx: Contexto, id: string, clave: string): TransaccionNueva {
  const { fila, asientos } = leer(ctx, id);
  return {
    tipo: fila.tipo as TransaccionNueva['tipo'],
    fecha: fila.fecha,
    origen: fila.origen as TransaccionNueva['origen'],
    claveIdempotencia: clave,
    asientos: asientos.map((a) => ({ cuentaId: a.cuentaId, monto: a.monto })),
    descripcion: fila.descripcion,
    comercio: fila.comercio,
    estimada: fila.estimada === 1,
    extraordinaria: fila.extraordinaria === 1,
    porRevisar: fila.porRevisar === 1,
    meta: fila.meta,
  };
}

/** "Deshacer" de una corrección: reemplaza la versión corregida por una copia de la original. */
export function deshacerCorreccion(ctx: Contexto, corregidaId: string, originalId: string): void {
  enTransaccion(ctx, () => {
    const r = ctx.libro.reemplazar(
      corregidaId,
      copia(ctx, originalId, `restaura:${originalId}:${corregidaId}`),
    );
    ctx.db
      .update(planMsi)
      .set({ transaccionAltaId: r.nueva.id })
      .where(eq(planMsi.transaccionAltaId, corregidaId))
      .run();
    liberarOcurrencias(ctx, corregidaId);
    cubrirAutomaticamente(ctx, r.nueva.id);
  });
}

// ——— Anular ———

export interface ResultadoAnulacion {
  readonly movimiento: ResumenTransaccion;
  readonly deshacer: string;
}

/** "Borra lo del cine": anula con transacción espejo (regla 2). */
export function anularPorVoz(ctx: Contexto, transaccionId: string): ResultadoAnulacion {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    if (estaAnulada(ctx, transaccionId)) throw new ErrorDominio('ya_anulada', 'ese movimiento ya no está');
    const movimiento = resumenTransaccion(ctx, transaccionId);
    anularMovimiento(ctx, transaccionId);
    return { movimiento, deshacer: `c:${transaccionId}` };
  });
}

/** "Deshacer" de una anulación: registra de nuevo una copia del movimiento (el libro no se edita). */
export function restaurarAnulado(ctx: Contexto, transaccionId: string): void {
  const r = ctx.libro.registrar(copia(ctx, transaccionId, `restaura:${transaccionId}`));
  if (!r.nueva) return;
  restaurarPlanDe(ctx, transaccionId, r.transaccion.id);
  cubrirAutomaticamente(ctx, r.transaccion.id);
}

// ——— Revisar duplicados ———

/**
 * "Creo que anoté dos veces la gasolina": movimientos de los últimos 30 días que coinciden con el filtro,
 * agrupados por monto; solo los grupos con dos o más son posibles duplicados.
 */
export function buscarDuplicados(
  ctx: Contexto,
  filtro: { texto?: string | undefined; fecha?: PlainDate | undefined },
  hoy: PlainDate,
): MovimientoVista[][] {
  const porMonto = new Map<number, MovimientoVista[]>();
  const ref = {
    ...(filtro.texto !== undefined ? { texto: filtro.texto } : {}),
    ...(filtro.fecha !== undefined ? { fecha: filtro.fecha } : {}),
  };
  for (const m of buscarMovimientos(ctx, ref, hoy)) {
    const clave = m.monto * 10 + (m.sentido === 'salida' ? 1 : m.sentido === 'entrada' ? 2 : 3);
    porMonto.set(clave, [...(porMonto.get(clave) ?? []), m]);
  }
  return [...porMonto.values()].filter((g) => g.length >= 2);
}

// ——— Configurar compromiso ———

export interface CompromisoConfigurado {
  readonly programadoId: string;
  readonly concepto: string;
  readonly monto: Centavos;
  readonly proxima: PlainDate | null;
  readonly deshacer: string;
}

type AjusteCompromiso = Extract<Ajuste, { tipo: 'compromiso' }>;

/**
 * "La renta son 6,500 cada día primero" → programado de egreso con su regla (E3.1) y sus ocurrencias
 * materializadas. Una regla única con fecha pasada arranca en esa fecha (queda vencida y se reserva).
 */
export function configurarCompromiso(
  ctx: Contexto,
  ajuste: AjusteCompromiso,
  hoy: PlainDate,
): CompromisoConfigurado {
  exigirConsentimiento(ctx);
  if ((ajuste.espacio ?? 'personal') !== 'personal') {
    throw new ErrorDominio('espacio_no_disponible', 'el perfil de negocio llega después');
  }
  const regla = validarRegla(ajuste.regla);
  let categoriaId: string | null = null;
  if (ajuste.categoria) {
    try {
      categoriaId = idCategoriaDe(ctx, ajuste.categoria, 'gasto');
    } catch {
      categoriaId = null;
    }
  }
  const concepto =
    ajuste.concepto?.trim() || (categoriaId ? cuentaPorId(ctx, categoriaId).nombre : null) || 'Pago fijo';
  const desde = regla.tipo === 'unica' ? minFecha(regla.fecha, hoy) : hoy;
  return enTransaccion(ctx, () => {
    const programadoId = insertarProgramado(ctx, {
      tipo: 'egreso',
      concepto,
      monto: ajuste.monto,
      regla,
      desde,
      categoriaCuentaId: categoriaId,
    });
    materializarOcurrencias(ctx);
    return {
      programadoId,
      concepto,
      monto: ajuste.monto,
      proxima: proximoPago(regla, hoy),
      deshacer: `p:${programadoId}`,
    };
  });
}

/** "Deshacer" de un compromiso dictado: lo desactiva y quita sus ocurrencias pendientes (no son del libro). */
export function deshacerCompromiso(ctx: Contexto, programadoId: string): void {
  enTransaccion(ctx, () => {
    ctx.db.update(programado).set({ activo: 0 }).where(eq(programado.id, programadoId)).run();
    ctx.db
      .delete(ocurrencia)
      .where(and(eq(ocurrencia.programadoId, programadoId), eq(ocurrencia.estado, 'pendiente')))
      .run();
  });
}
