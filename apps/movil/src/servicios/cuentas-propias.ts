import { eq } from 'drizzle-orm';
import {
  construirConciliacion,
  ErrorDominio,
  type Centavos,
  type PlainDate,
  type Regla,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, cuentasPropias } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { listarOcurrencias, materializarOcurrencias } from './ocurrencias';
import { actualizarMontoProgramado, desactivarProgramado, programadosActivos } from './programados';

const { programado, tanda, suscripcion } = esquema;

/**
 * Cuentas después del onboarding (`02 §11`): el detalle de una cuenta de Tienes con «Corregir saldo» y los pagos
 * fijos con «Cambiar monto» y «Quitar». Todo lo financiero pasa por el libro: corregir un saldo registra una
 * conciliación nueva (`04 §4` caso 22); nunca se edita ni se borra un asiento (regla 2).
 */

/** Cuentas de Tienes que se corrigen escribiendo el saldo; el efectivo se corrige contándolo (arqueo, `02 §7`). */
const SUBTIPOS_CORREGIBLES = ['debito', 'billetera', 'ahorro'] as const;
type SubtipoTienes = 'efectivo' | (typeof SUBTIPOS_CORREGIBLES)[number];

export interface DetalleCuentaPropia {
  readonly id: string;
  readonly nombre: string;
  readonly subtipo: SubtipoTienes;
  readonly ultimos4: string | null;
  readonly saldo: Centavos;
  /** Débito, billetera y ahorro: «Corregir saldo». El efectivo se cuenta con el arqueo. */
  readonly corregible: boolean;
}

/** Una cuenta de Tienes por id; `null` si no existe, está archivada o no es de Tienes (tarjetas, personas). */
export function detalleCuentaPropia(ctx: Contexto, cuentaId: string): DetalleCuentaPropia | null {
  const c = cuentasPropias(ctx).find((x) => x.id === cuentaId);
  if (!c || c.subtipo === 'tarjeta_credito') return null;
  return {
    id: c.id,
    nombre: c.nombre,
    subtipo: c.subtipo,
    ultimos4: c.ultimos4,
    saldo: ctx.libro.saldo(c.id),
    corregible: (SUBTIPOS_CORREGIBLES as readonly string[]).includes(c.subtipo),
  };
}

export interface SaldoCuentaCorregido {
  /** `null` si el saldo ya coincidía (no se registra nada). */
  readonly transaccionId: string | null;
  readonly saldo: Centavos;
}

/**
 * «Corregir saldo» de débito, billetera o ahorro («En BBVA tengo 4,200», `04 §4` caso 22): una `conciliacion`
 * contra `capital:ajuste_conciliacion` por la diferencia, fechada hoy. Lo anterior queda intacto en el libro.
 */
export function corregirSaldoCuenta(
  ctx: Contexto,
  cuentaId: string,
  saldoReal: Centavos,
): SaldoCuentaCorregido {
  exigirConsentimiento(ctx);
  if (!Number.isSafeInteger(saldoReal) || saldoReal < 0) {
    throw new ErrorDominio('monto_invalido', 'revisa el saldo');
  }
  return enTransaccion(ctx, () => {
    const c = cuentaPorId(ctx, cuentaId);
    if (
      c.naturaleza !== 'activo' ||
      c.sistema !== 0 ||
      c.archivada !== 0 ||
      !(SUBTIPOS_CORREGIBLES as readonly string[]).includes(c.subtipo)
    ) {
      throw new ErrorDominio('cuenta_invalida', 'esta cuenta no se corrige escribiendo el saldo');
    }
    const saldoLibro = ctx.libro.saldo(c.id);
    if (saldoLibro === saldoReal) return { transaccionId: null, saldo: saldoReal };
    const m = construirConciliacion({
      cuenta: c.id,
      capital: CUENTAS_SISTEMA.ajusteConciliacion,
      saldoLibro,
      saldoReal,
    });
    const { transaccion } = ctx.libro.registrar({
      tipo: m.tipo,
      fecha: ctx.reloj.hoy(),
      origen: 'manual',
      claveIdempotencia: `conciliacion:${ctx.generarId()}`,
      asientos: m.asientos,
    });
    return { transaccionId: transaccion.id, saldo: saldoReal };
  });
}

// ——— Pagos fijos (Cuentas › Compromisos) ———

/**
 * De dónde viene un compromiso: los pagos fijos se cambian y se quitan aquí; los de una tarjeta, una tanda o una
 * suscripción se manejan en su propia pantalla (quitarlos aquí dejaría la tanda o la suscripción a medias).
 */
export type OrigenCompromiso = 'pago_fijo' | 'tarjeta' | 'tanda' | 'suscripcion';

export interface PagoFijoVista {
  readonly id: string;
  readonly concepto: string;
  readonly monto: Centavos;
  readonly regla: Regla;
  readonly variable: boolean;
  /** Nombre de la cuenta de la que sale, si se eligió. */
  readonly cuenta: string | null;
  /** Último pago (inclusivo), si se sabe cuántos faltan. */
  readonly hasta: PlainDate | null;
  /** Próxima fecha pendiente; `null` si ya no quedan (o caen fuera de la ventana de 90 días). */
  readonly proxima: PlainDate | null;
  readonly origen: OrigenCompromiso;
  /** Para abrir la pantalla que lo maneja cuando no es un pago fijo. */
  readonly tarjetaId: string | null;
  readonly tandaId: string | null;
}

function origenDe(ctx: Contexto, id: string): { origen: OrigenCompromiso; tandaId: string | null } {
  const fila = ctx.db
    .select({ tarjetaId: programado.tarjetaId, comercio: programado.comercioNormalizado })
    .from(programado)
    .where(eq(programado.id, id))
    .get();
  if (fila?.tarjetaId) return { origen: 'tarjeta', tandaId: null };
  const t = ctx.db.select({ id: tanda.id }).from(tanda).where(eq(tanda.programadoId, id)).get();
  if (t) return { origen: 'tanda', tandaId: t.id };
  const s = ctx.db
    .select({ c: suscripcion.comercioNormalizado })
    .from(suscripcion)
    .where(eq(suscripcion.programadoId, id))
    .get();
  if (s || fila?.comercio) return { origen: 'suscripcion', tandaId: null };
  return { origen: 'pago_fijo', tandaId: null };
}

/**
 * Todos los compromisos de egreso activos del espacio personal, en orden de alta (no solo los de los próximos 30
 * días que muestra Cuentas): así se ven también los anuales y los que caen lejos.
 */
export function listarPagosFijos(ctx: Contexto): PagoFijoVista[] {
  materializarOcurrencias(ctx);
  const proximas = new Map<string, PlainDate>();
  for (const o of listarOcurrencias(ctx, { estado: 'pendiente', tipo: 'egreso' })) {
    if (!proximas.has(o.programadoId)) proximas.set(o.programadoId, o.fecha);
  }
  const nombres = new Map(cuentasPropias(ctx).map((c) => [c.id, c.nombre]));
  return programadosActivos(ctx)
    .filter((p) => p.tipo === 'egreso')
    .map((p) => {
      const { origen, tandaId } = origenDe(ctx, p.id);
      return {
        id: p.id,
        concepto: p.concepto,
        monto: p.monto,
        regla: p.regla,
        variable: p.variable,
        cuenta: p.cuentaId ? (nombres.get(p.cuentaId) ?? null) : null,
        hasta: p.hasta,
        proxima: proximas.get(p.id) ?? null,
        origen,
        tarjetaId: p.tarjetaId,
        tandaId,
      };
    });
}

/** Un compromiso activo por id; `null` si ya no existe o se quitó. */
export function detallePagoFijo(ctx: Contexto, programadoId: string): PagoFijoVista | null {
  return listarPagosFijos(ctx).find((p) => p.id === programadoId) ?? null;
}

function exigirPagoFijo(ctx: Contexto, programadoId: string): void {
  const p = programadosActivos(ctx).find((x) => x.id === programadoId && x.tipo === 'egreso');
  if (!p) throw new ErrorDominio('programado_inexistente', 'ese pago ya no existe');
  if (origenDe(ctx, programadoId).origen !== 'pago_fijo') {
    throw new ErrorDominio('compromiso_no_editable', 'ese pago se cambia desde su propia pantalla');
  }
}

/**
 * «Cambiar monto»: lo que se aparta en adelante (las ocurrencias pendientes toman el monto del programado). No
 * toca movimientos ya registrados.
 */
export function cambiarMontoPagoFijo(ctx: Contexto, programadoId: string, monto: Centavos): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    exigirPagoFijo(ctx, programadoId);
    actualizarMontoProgramado(ctx, programadoId, monto);
  });
}

/** «Quitar»: lo desactiva y deja de apartarse (sus ocurrencias pendientes se van; las pagadas se quedan). */
export function quitarPagoFijoActivo(ctx: Contexto, programadoId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    exigirPagoFijo(ctx, programadoId);
    desactivarProgramado(ctx, programadoId);
  });
}
