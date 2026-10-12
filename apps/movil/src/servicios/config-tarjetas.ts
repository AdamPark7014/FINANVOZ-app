import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  construirConciliacion,
  ErrorDominio,
  validarTarjeta,
  type Centavos,
  type PlainDate,
  type Regla,
  type TarjetaCredito,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { normalizarAlias, ReglaRecurrente, type Ajuste } from '@cartera/nlu';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { normalizarAliases } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { procesarCortes } from './cortes';
import { materializarOcurrencias } from './ocurrencias';
import { escribirAjuste } from './preferencias';
import { insertarProgramado, programadoPorId, validarRegla } from './programados';
import { claveCicloDesde, tarjetaPorId, tarjetasActivas, type TarjetaLeida } from './tarjetas';

const { cuenta, tarjeta, programado, ocurrencia, aliasCuenta } = esquema;

// ——— Formulario (RF-TAR-01) ———

export const CambiosTarjeta = z
  .strictObject({
    nombre: z.string().trim().min(1).max(60).optional(),
    ultimos4: z
      .string()
      .regex(/^\d{4}$/)
      .nullable()
      .optional(),
    diaCorte: z.int().min(1).max(31).optional(),
    diaLimitePago: z.int().min(1).max(31).optional(),
    diasParaPagar: z.int().min(1).max(60).optional(),
    limiteCredito: z.int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
    modo: z.enum(['totalero', 'plan']).optional(),
    /** Tasa anual en puntos base (para la sugerencia avalancha, RF-TAR-06). */
    tasaAnualBp: z.int().min(0).max(100_000).nullable().optional(),
  })
  .refine((c) => c.diaLimitePago === undefined || c.diasParaPagar === undefined, {
    message: 'día límite o días para pagar, uno de los dos',
  });
export type CambiosTarjeta = z.input<typeof CambiosTarjeta>;

export interface TarjetaEditada {
  readonly tarjetaId: string;
  readonly antes: TarjetaCredito;
  readonly ciclo: TarjetaCredito;
  /** Token de "Deshacer" (solo cuando cambió el ciclo). */
  readonly deshacer: string | null;
}

function mismoCiclo(a: TarjetaCredito, b: TarjetaCredito): boolean {
  return (
    a.diaCorte === b.diaCorte && a.diaLimitePago === b.diaLimitePago && a.diasParaPagar === b.diasParaPagar
  );
}

/**
 * Editar una tarjeta desde el formulario (o por voz, `tarjeta_ciclo`). Si cambia el ciclo, antes se cierran los
 * cortes pendientes con el ciclo viejo y desde hoy solo se procesan cortes posteriores (E5.3): ningún periodo se
 * cierra dos veces. El saldo no se edita aquí: "Corregir saldo" registra una conciliación.
 */
export function editarTarjeta(ctx: Contexto, tarjetaId: string, cambios: CambiosTarjeta): TarjetaEditada {
  exigirConsentimiento(ctx);
  const r = CambiosTarjeta.safeParse(cambios);
  if (!r.success) throw new ErrorDominio('tarjeta_invalida', 'revisa los datos de la tarjeta');
  const c = r.data;
  return enTransaccion(ctx, () => {
    const t = tarjetaPorId(ctx, tarjetaId);
    const ciclo: TarjetaCredito = {
      diaCorte: c.diaCorte ?? t.ciclo.diaCorte,
      ...(c.diaLimitePago !== undefined
        ? { diaLimitePago: c.diaLimitePago }
        : c.diasParaPagar !== undefined
          ? { diasParaPagar: c.diasParaPagar }
          : t.ciclo.diasParaPagar !== undefined
            ? { diasParaPagar: t.ciclo.diasParaPagar }
            : { diaLimitePago: t.ciclo.diaLimitePago as number }),
    };
    validarTarjeta(ciclo);
    const cambiaCiclo = !mismoCiclo(ciclo, t.ciclo);
    if (cambiaCiclo) {
      procesarCortes(ctx);
      escribirAjuste(ctx, claveCicloDesde(tarjetaId), z.strictObject({ fecha: z.string() }), {
        fecha: ctx.reloj.hoy(),
      });
    }
    ctx.db
      .update(tarjeta)
      .set({
        diaCorte: ciclo.diaCorte,
        diaLimitePago: ciclo.diaLimitePago ?? null,
        diasParaPagar: ciclo.diasParaPagar ?? null,
        ...(c.limiteCredito !== undefined ? { limiteCredito: c.limiteCredito } : {}),
        ...(c.modo !== undefined ? { modo: c.modo } : {}),
        ...(c.tasaAnualBp !== undefined ? { tasaAnualBp: c.tasaAnualBp } : {}),
      })
      .where(eq(tarjeta.cuentaId, tarjetaId))
      .run();
    if (c.nombre !== undefined || c.ultimos4 !== undefined) {
      ctx.db
        .update(cuenta)
        .set({
          ...(c.nombre !== undefined ? { nombre: c.nombre } : {}),
          ...(c.ultimos4 !== undefined ? { ultimos4: c.ultimos4 } : {}),
        })
        .where(eq(cuenta.id, tarjetaId))
        .run();
      if (c.nombre !== undefined) {
        for (const a of normalizarAliases([c.nombre])) {
          ctx.db
            .insert(aliasCuenta)
            .values({ cuentaId: tarjetaId, aliasNormalizado: a })
            .onConflictDoNothing()
            .run();
        }
      }
    }
    const antes = t.ciclo;
    const token = `t:${tarjetaId}:${antes.diaCorte}:${antes.diaLimitePago ?? ''}:${antes.diasParaPagar ?? ''}`;
    return { tarjetaId, antes, ciclo, deshacer: cambiaCiclo ? token : null };
  });
}

/** "Deshacer" de un cambio de ciclo: vuelve a los días anteriores. */
export function deshacerCicloTarjeta(ctx: Contexto, token: string): void {
  const [, id = '', corte = '', limite = '', dias = ''] = token.split(':');
  editarTarjeta(ctx, id, {
    diaCorte: Number(corte),
    ...(limite !== '' ? { diaLimitePago: Number(limite) } : { diasParaPagar: Number(dias) }),
  });
}

export interface SaldoCorregido {
  readonly transaccionId: string | null;
  /** Deuda revolvente después de corregir (negativa = saldo a favor). */
  readonly saldoRevolvente: Centavos;
}

/**
 * "Corregir saldo" (`02 §8`, `04 §4` caso 22): registra una conciliación por la diferencia entre lo que dice el
 * banco y lo que dice la app. `deuda` es lo que debes hoy (negativa = saldo a favor). Sin diferencia no registra.
 */
export function corregirSaldoTarjeta(ctx: Contexto, tarjetaId: string, deuda: Centavos): SaldoCorregido {
  exigirConsentimiento(ctx);
  if (!Number.isSafeInteger(deuda)) throw new ErrorDominio('monto_invalido', 'revisa el saldo');
  return enTransaccion(ctx, () => {
    const t = tarjetaPorId(ctx, tarjetaId);
    if (t.saldoRevolvente === deuda) return { transaccionId: null, saldoRevolvente: deuda };
    const m = construirConciliacion({
      cuenta: tarjetaId,
      capital: CUENTAS_SISTEMA.ajusteConciliacion,
      saldoReal: -deuda,
      saldoLibro: -t.saldoRevolvente,
    });
    const { transaccion } = ctx.libro.registrar({
      tipo: m.tipo,
      fecha: ctx.reloj.hoy(),
      origen: 'manual',
      claveIdempotencia: `conciliacion:${ctx.generarId()}`,
      asientos: m.asientos,
    });
    return { transaccionId: transaccion.id, saldoRevolvente: deuda };
  });
}

// ——— Por voz: "mi Nu corta el 28 y pago el 18" (`06 §3`, K01, K05) ———

type AjusteCiclo = Extract<Ajuste, { tipo: 'tarjeta_ciclo' }>;

/** Lo que el formulario de tarjeta nueva recibe prellenado cuando la tarjeta dictada no existe. */
export interface TarjetaPorAgregar {
  readonly alias: string | null;
  readonly diaCorte: number | null;
  readonly diaLimitePago: number | null;
  readonly diasParaPagar: number | null;
}

export type ResultadoCicloVoz =
  | { readonly resultado: 'tarjeta_configurada'; readonly tarjeta: string; readonly editada: TarjetaEditada }
  /** No existe (o no se sabe cuál): el formulario la agrega; el saldo es obligatorio (`02 §3.1`). */
  | {
      readonly resultado: 'tarjeta_por_agregar';
      readonly prellenado: TarjetaPorAgregar;
      readonly candidatas: readonly { readonly id: string; readonly nombre: string }[];
    };

function tarjetasConAlias(ctx: Contexto, alias: string): TarjetaLeida[] {
  const buscado = normalizarAlias(alias);
  if (buscado === '') return [];
  const ids = new Set(
    ctx.db
      .select({ id: aliasCuenta.cuentaId })
      .from(aliasCuenta)
      .where(eq(aliasCuenta.aliasNormalizado, buscado))
      .all()
      .map((f) => f.id),
  );
  return tarjetasActivas(ctx).filter((t) => ids.has(t.cuentaId));
}

/**
 * `configurar` `tarjeta_ciclo`: con una sola tarjeta que coincide (por alias, o la única tarjeta si no se dijo
 * cuál) cambia su ciclo; si no, devuelve lo dictado para abrir el formulario de tarjeta nueva.
 */
export function configurarCicloPorVoz(ctx: Contexto, ajuste: AjusteCiclo): ResultadoCicloVoz {
  exigirConsentimiento(ctx);
  const todas = tarjetasActivas(ctx);
  const coincidencias = ajuste.alias ? tarjetasConAlias(ctx, ajuste.alias) : todas.length === 1 ? todas : [];
  const prellenado: TarjetaPorAgregar = {
    alias: ajuste.alias ?? null,
    diaCorte: ajuste.dia_corte ?? null,
    diaLimitePago: ajuste.dia_limite_pago ?? null,
    diasParaPagar: ajuste.dias_para_pagar ?? null,
  };
  const [unica] = coincidencias;
  const hayCambios =
    ajuste.dia_corte !== undefined ||
    ajuste.dia_limite_pago !== undefined ||
    ajuste.dias_para_pagar !== undefined;
  if (!unica || coincidencias.length > 1 || !hayCambios) {
    return {
      resultado: 'tarjeta_por_agregar',
      prellenado,
      candidatas: (coincidencias.length > 1 ? coincidencias : todas).map((t) => ({
        id: t.cuentaId,
        nombre: t.nombre,
      })),
    };
  }
  const editada = editarTarjeta(ctx, unica.cuentaId, {
    ...(ajuste.dia_corte !== undefined ? { diaCorte: ajuste.dia_corte } : {}),
    ...(ajuste.dia_limite_pago !== undefined ? { diaLimitePago: ajuste.dia_limite_pago } : {}),
    ...(ajuste.dias_para_pagar !== undefined && ajuste.dia_limite_pago === undefined
      ? { diasParaPagar: ajuste.dias_para_pagar }
      : {}),
  });
  return { resultado: 'tarjeta_configurada', tarjeta: unica.nombre, editada };
}

// ——— Pagos planeados de tarjetas en modo plan (RF-TAR-06) ———

export const EntradaPagoPlaneado = z.strictObject({
  tarjetaId: z.string().min(1),
  monto: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  /** Recurrente (cada quincena, cada mes…) o `unica`. */
  regla: z.unknown(),
  /** De qué cuenta sale; `null` = se pregunta al pagar. */
  cuentaId: z.string().nullable().default(null),
  desde: z.string().optional(),
  hasta: z.string().nullable().default(null),
});
export type EntradaPagoPlaneado = Omit<z.input<typeof EntradaPagoPlaneado>, 'regla'> & { regla: Regla };

export interface PagoPlaneadoVista {
  readonly programadoId: string;
  readonly tarjetaId: string;
  readonly concepto: string;
  readonly monto: Centavos;
  readonly regla: Regla;
  readonly cuentaId: string | null;
  readonly desde: PlainDate;
  readonly hasta: PlainDate | null;
  /** Próximas fechas pendientes (ocurrencias). */
  readonly proximas: readonly PlainDate[];
}

/**
 * Pago planeado de una tarjeta en modo plan: un programado de egreso con `tarjeta_id` (`04 §3`). Con pagos
 * planeados, E4 reserva solo los que vencen en el horizonte; sin ellos, la deuda completa (E4-08, CA-M4-12). Un
 * pago a la tarjeta cubre su ocurrencia (E3.5: su "categoría" es la tarjeta).
 */
export function agregarPagoPlaneado(ctx: Contexto, entrada: EntradaPagoPlaneado): string {
  exigirConsentimiento(ctx);
  const r = EntradaPagoPlaneado.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('pago_planeado_invalido', 'revisa el pago planeado');
  const e = r.data;
  return enTransaccion(ctx, () => {
    const t = tarjetaPorId(ctx, e.tarjetaId);
    if (t.modo !== 'plan') {
      throw new ErrorDominio(
        'tarjeta_totalera',
        'los pagos planeados son de tarjetas que no pagas completas',
      );
    }
    const regla = validarRegla(e.regla);
    if (regla.tipo !== 'unica') ReglaRecurrente.parse(regla);
    const id = insertarProgramado(ctx, {
      tipo: 'egreso',
      concepto: `Pago ${t.nombre}`,
      monto: e.monto,
      regla,
      desde: e.desde ?? (regla.tipo === 'unica' ? regla.fecha : ctx.reloj.hoy()),
      hasta: e.hasta,
      cuentaId: e.cuentaId,
    });
    ctx.db.update(programado).set({ tarjetaId: t.cuentaId }).where(eq(programado.id, id)).run();
    materializarOcurrencias(ctx);
    return id;
  });
}

/** Pagos planeados activos de una tarjeta (o de todas). */
export function listarPagosPlaneados(ctx: Contexto, tarjetaId?: string): PagoPlaneadoVista[] {
  materializarOcurrencias(ctx);
  const condiciones = [eq(programado.activo, 1), isNotNull(programado.tarjetaId)];
  if (tarjetaId) condiciones.push(eq(programado.tarjetaId, tarjetaId));
  return ctx.db
    .select()
    .from(programado)
    .where(and(...condiciones))
    .orderBy(asc(programado.desde), asc(programado.id))
    .all()
    .map((f) => {
      const p = programadoPorId(ctx, f.id);
      const proximas = ctx.db
        .select({ fecha: ocurrencia.fecha })
        .from(ocurrencia)
        .where(and(eq(ocurrencia.programadoId, f.id), eq(ocurrencia.estado, 'pendiente')))
        .orderBy(asc(ocurrencia.fecha))
        .all()
        .map((o) => o.fecha);
      return {
        programadoId: f.id,
        tarjetaId: f.tarjetaId as string,
        concepto: p.concepto,
        monto: p.monto,
        regla: p.regla,
        cuentaId: p.cuentaId,
        desde: p.desde,
        hasta: p.hasta,
        proximas,
      };
    });
}

/** Quita un pago planeado: el programado se desactiva y sus ocurrencias pendientes desaparecen. */
export function quitarPagoPlaneado(ctx: Contexto, programadoId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    const p = programadoPorId(ctx, programadoId);
    if (!p.tarjetaId) throw new ErrorDominio('programado_invalido', 'no es un pago planeado de tarjeta');
    ctx.db.update(programado).set({ activo: 0 }).where(eq(programado.id, programadoId)).run();
    ctx.db
      .delete(ocurrencia)
      .where(and(eq(ocurrencia.programadoId, programadoId), eq(ocurrencia.estado, 'pendiente')))
      .run();
  });
}

export interface SugerenciaAvalancha {
  readonly tarjetaId: string;
  readonly nombre: string;
  readonly tasaAnualBp: number | null;
  readonly deuda: Centavos;
}

/**
 * Sugerencia avalancha (RF-TAR-06): las tarjetas en modo plan con deuda, de la tasa más alta a la más baja (las
 * que no tienen tasa van al final). Solo ordena: no calcula intereses.
 */
export function sugerenciaAvalancha(ctx: Contexto): SugerenciaAvalancha[] {
  return tarjetasActivas(ctx)
    .filter((t) => t.modo === 'plan' && t.saldoRevolvente > 0)
    .map((t) => ({
      tarjetaId: t.cuentaId,
      nombre: t.nombre,
      tasaAnualBp: t.tasaAnualBp,
      deuda: t.saldoRevolvente,
    }))
    .sort((a, b) => (b.tasaAnualBp ?? -1) - (a.tasaAnualBp ?? -1) || b.deuda - a.deuda);
}

/** Usado por pruebas y por la pantalla: ciclo leído de la base. */
export function cicloDeTarjeta(ctx: Contexto, tarjetaId: string): TarjetaCredito {
  return tarjetaPorId(ctx, tarjetaId).ciclo;
}
