import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ErrorDominio,
  expandirProgramados,
  minFecha,
  sumarDias,
  type Centavos,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { registrarMovimiento, type MovimientoRegistrado } from './formulario';
import { escribirAjuste, leerAjuste } from './preferencias';
import { programadoPorId, programadosActivos } from './programados';

const { ocurrencia, programado, transaccion } = esquema;

/** Ventana de materialización: `[desde, hoy + 90)` (`04 §5`). */
export const DIAS_MATERIALIZACION = 90;

/**
 * Crea las ocurrencias de cada programado activo con fecha efectiva en `[desde, hoy + 90)` sin pasar de
 * `hasta` (inclusivo), con E3.4. Idempotente por la llave primaria. Devuelve cuántas creó.
 */
export function materializarOcurrencias(ctx: Contexto): number {
  const tope = sumarDias(ctx.reloj.hoy(), DIAS_MATERIALIZACION);
  let creadas = 0;
  enTransaccion(ctx, () => {
    for (const p of programadosActivos(ctx)) {
      const fin = p.hasta ? minFecha(tope, sumarDias(p.hasta, 1)) : tope;
      if (fin <= p.desde) continue;
      const fechas = expandirProgramados(
        [{ concepto: p.concepto, monto: p.monto, regla: p.regla }],
        p.desde,
        fin,
      ).map((o) => o.fecha);
      for (const fecha of new Set(fechas)) {
        const r = ctx.db
          .insert(ocurrencia)
          .values({ programadoId: p.id, fecha, estado: 'pendiente' })
          .onConflictDoNothing()
          .run() as { changes?: number };
        creadas += Number(r.changes ?? 0);
      }
    }
  });
  return creadas;
}

export type EstadoOcurrencia = 'pendiente' | 'cubierta' | 'omitida';

export interface OcurrenciaVista {
  readonly programadoId: string;
  readonly fecha: PlainDate;
  readonly estado: EstadoOcurrencia;
  readonly tipo: 'ingreso' | 'egreso';
  readonly concepto: string;
  readonly monto: Centavos;
  readonly cuentaId: string | null;
  readonly categoriaCuentaId: string | null;
  readonly tarjetaId: string | null;
  readonly variable: boolean;
  readonly defineHorizonte: boolean;
  readonly transaccionId: string | null;
}

/** Ocurrencias de programados activos del espacio personal, por fecha y concepto. */
export function listarOcurrencias(
  ctx: Contexto,
  filtro: { estado?: EstadoOcurrencia; tipo?: 'ingreso' | 'egreso'; programadoId?: string } = {},
): OcurrenciaVista[] {
  const condiciones = [eq(programado.activo, 1), eq(programado.espacio, 'personal')];
  if (filtro.estado) condiciones.push(eq(ocurrencia.estado, filtro.estado));
  if (filtro.tipo) condiciones.push(eq(programado.tipo, filtro.tipo));
  if (filtro.programadoId) condiciones.push(eq(ocurrencia.programadoId, filtro.programadoId));
  return ctx.db
    .select({ o: ocurrencia, p: programado })
    .from(ocurrencia)
    .innerJoin(programado, eq(programado.id, ocurrencia.programadoId))
    .where(and(...condiciones))
    .orderBy(asc(ocurrencia.fecha), asc(programado.concepto))
    .all()
    .map(({ o, p }) => ({
      programadoId: o.programadoId,
      fecha: o.fecha,
      estado: o.estado,
      tipo: p.tipo,
      concepto: p.concepto,
      monto: p.monto,
      cuentaId: p.cuentaId,
      categoriaCuentaId: p.categoriaCuentaId,
      tarjetaId: p.tarjetaId,
      variable: p.variable === 1,
      defineHorizonte: p.defineHorizonte === 1,
      transaccionId: o.transaccionId,
    }));
}

export interface RefOcurrencia {
  readonly programadoId: string;
  readonly fecha: PlainDate;
}

function exigirPendiente(ctx: Contexto, ref: RefOcurrencia, tipo?: 'ingreso' | 'egreso') {
  const fila = ctx.db
    .select()
    .from(ocurrencia)
    .where(and(eq(ocurrencia.programadoId, ref.programadoId), eq(ocurrencia.fecha, ref.fecha)))
    .get();
  if (!fila) throw new ErrorDominio('ocurrencia_inexistente', 'no existe ese pago programado en esa fecha');
  if (fila.estado !== 'pendiente') throw new ErrorDominio('ocurrencia_resuelta', 'ese pago ya está resuelto');
  const p = programadoPorId(ctx, ref.programadoId);
  if (tipo && p.tipo !== tipo) throw new ErrorDominio('ocurrencia_invalida', 'no corresponde a esta acción');
  return p;
}

function marcar(ctx: Contexto, ref: RefOcurrencia, estado: EstadoOcurrencia, transaccionId: string | null) {
  ctx.db
    .update(ocurrencia)
    .set({ estado, transaccionId })
    .where(and(eq(ocurrencia.programadoId, ref.programadoId), eq(ocurrencia.fecha, ref.fecha)))
    .run();
}

function slugDe(ctx: Contexto, categoriaCuentaId: string | null, porOmision: string): string {
  if (!categoriaCuentaId) return porOmision;
  return cuentaPorId(ctx, categoriaCuentaId).categoriaSlug ?? porOmision;
}

/**
 * "Ya la pagué" (`02 §4.1`): registra el gasto prellenado con el concepto y la categoría del programado y
 * marca la ocurrencia cubierta por esa transacción, todo en una transacción SQLite. `origenId` es de dónde
 * salió (por omisión, la cuenta del programado).
 */
export function yaLaPague(
  ctx: Contexto,
  e: RefOcurrencia & { origenId?: string; monto?: Centavos; fechaPago?: PlainDate },
): MovimientoRegistrado {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const p = exigirPendiente(ctx, e, 'egreso');
    const origenId = e.origenId ?? p.cuentaId;
    if (!origenId) throw new ErrorDominio('cuenta_requerida', '¿de qué cuenta salió?');
    const comunes = {
      monto: e.monto ?? p.monto,
      fecha: e.fechaPago ?? ctx.reloj.hoy(),
      descripcion: p.concepto,
    };
    // Pago planeado de una tarjeta en modo plan (RF-TAR-06): es un pago a la tarjeta, no un gasto.
    const registrado = p.tarjetaId
      ? registrarMovimiento(
          ctx,
          { tipo: 'pago_tarjeta', ...comunes, origenId, destinoId: p.tarjetaId },
          { cubrir: false },
        )
      : registrarMovimiento(
          ctx,
          {
            tipo: 'gasto',
            ...comunes,
            categoria: slugDe(ctx, p.categoriaCuentaId, 'otros_gastos'),
            origenId,
          },
          { cubrir: false },
        );
    marcar(ctx, e, 'cubierta', registrado.transaccionId);
    return registrado;
  });
}

/**
 * "Ya está registrado" / "Sí, ya llegó" con un movimiento existente: cubre la ocurrencia con esa transacción
 * vigente (ingreso para una de ingreso; gasto o pago de tarjeta para una de egreso, E3.5).
 */
export function cubrirConMovimiento(ctx: Contexto, e: RefOcurrencia & { transaccionId: string }): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const p = exigirPendiente(ctx, e);
    const t = ctx.db.select().from(transaccion).where(eq(transaccion.id, e.transaccionId)).get();
    const anulada = ctx.db.select().from(transaccion).where(eq(transaccion.revierteA, e.transaccionId)).get();
    if (!t || anulada || t.tipo === 'reversa') {
      throw new ErrorDominio('transaccion_inexistente', 'ese movimiento no existe o está anulado');
    }
    const validos =
      p.tipo === 'ingreso' ? ['ingreso'] : ['gasto', 'pago_tarjeta', 'cuenta_dividida', 'aportacion_tanda'];
    if (!validos.includes(t.tipo)) {
      throw new ErrorDominio('movimiento_no_cubre', 'ese movimiento no puede cubrir este pago');
    }
    marcar(ctx, e, 'cubierta', t.id);
  });
}

/**
 * "Sí, ya llegó" (`02 §4.1`, ingreso que no llegó o día de pago): registra el ingreso prellenado y cubre la
 * ocurrencia; E3.3 recalcula el horizonte al siguiente ingreso (CA-M2-08).
 */
export function confirmarIngresoRecibido(
  ctx: Contexto,
  e: RefOcurrencia & { destinoId?: string; monto?: Centavos; fechaPago?: PlainDate },
): MovimientoRegistrado {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const p = exigirPendiente(ctx, e, 'ingreso');
    const destinoId = e.destinoId ?? p.cuentaId;
    if (!destinoId) throw new ErrorDominio('cuenta_requerida', '¿a qué cuenta llegó?');
    const registrado = registrarMovimiento(
      ctx,
      {
        tipo: 'ingreso',
        monto: e.monto ?? p.monto,
        fecha: e.fechaPago ?? ctx.reloj.hoy(),
        categoria: slugDe(ctx, p.categoriaCuentaId, 'otros_ingresos'),
        destinoId,
        descripcion: p.concepto,
      },
      { cubrir: false },
    );
    marcar(ctx, e, 'cubierta', registrado.transaccionId);
    return registrado;
  });
}

/** "Ya no aplica" / "Este periodo no me pagan": la ocurrencia se omite y E4 deja de reservarla. */
export function omitirOcurrencia(ctx: Contexto, e: RefOcurrencia): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    exigirPendiente(ctx, e);
    marcar(ctx, e, 'omitida', null);
  });
}

const Pospuesta = z.strictObject({ fecha: z.string() });
const clavePospuesta = (e: RefOcurrencia) => `pospuesta:${e.programadoId}:${e.fecha}`;

/**
 * "Todavía no": la ocurrencia sigue pendiente (y reservada en E4); la tarjeta de acción se oculta el resto del
 * día y vuelve a preguntar mañana.
 */
export function todaviaNo(ctx: Contexto, e: RefOcurrencia): void {
  exigirConsentimiento(ctx);
  exigirPendiente(ctx, e);
  escribirAjuste(ctx, clavePospuesta(e), Pospuesta, { fecha: ctx.reloj.hoy() });
}

/** ¿La persona respondió "Todavía no" hoy? */
export function pospuestaHoy(ctx: Contexto, e: RefOcurrencia): boolean {
  return leerAjuste(ctx, clavePospuesta(e), Pospuesta)?.fecha === ctx.reloj.hoy();
}
