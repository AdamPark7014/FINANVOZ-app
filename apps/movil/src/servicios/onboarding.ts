import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ErrorDominio,
  construirConciliacion,
  construirMsiExistente,
  construirSaldoInicial,
  corteDe,
  proximasFechas,
  sumarDias,
  validarTarjeta,
  type Centavos,
  type PlainDate,
  type Regla,
  type TarjetaCredito,
} from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { ReglaRecurrente } from '@cartera/nlu';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { marcarIngresoVariable } from './ajustes';
import { crearAvisoMsiDoble } from './avisos';
import { idCategoriaDe, insertarCuenta } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { desactivarProgramado, insertarProgramado, validarRegla } from './programados';
import { tarjetaPorId } from './tarjetas';

const { programado, tarjeta, planMsi } = esquema;

const Monto = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
const Saldo = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
const Nombre = z.string().trim().min(1).max(60);
const Ultimos4 = z.string().regex(/^\d{4}$/);

function validar<T>(forma: z.ZodType<T>, valor: unknown, codigo: string): T {
  const r = forma.safeParse(valor);
  if (!r.success) throw new ErrorDominio(codigo, 'revisa los datos');
  return r.data;
}

/** `saldo_inicial` contra `capital:saldos_iniciales` (`02 §3`, `04 §4` caso 11). `saldo` con signo del libro. */
export function registrarSaldoInicial(
  ctx: Contexto,
  cuentaId: string,
  saldo: Centavos,
  fecha: PlainDate,
): void {
  if (saldo === 0) return;
  const m = construirSaldoInicial({ cuenta: cuentaId, capital: CUENTAS_SISTEMA.saldosIniciales, saldo });
  ctx.libro.registrar({
    tipo: m.tipo,
    fecha,
    origen: 'manual',
    claveIdempotencia: `saldo_inicial:${cuentaId}`,
    asientos: m.asientos,
  });
}

// ——— O3 · Ingreso ———

/** Chips de O3 (`02 §3`). "Varía" → `configurarIngresoVariable`. */
export const FRECUENCIAS_INGRESO = ['quincena', 'semanal', 'catorcenal', 'mensual', 'varia'] as const;

export const EntradaIngreso = z.strictObject({
  concepto: Nombre.default('quincena'),
  monto: Monto,
  regla: ReglaRecurrente,
  /** A dónde llega; `null` = cualquiera. */
  cuentaId: z.string().nullable().default(null),
  categoria: z.string().default('sueldo'),
});
export type EntradaIngreso = Omit<z.input<typeof EntradaIngreso>, 'regla'> & { regla: Regla };

/** "Próximo pago precalculado" de O3. */
export function proximoPago(regla: Regla, hoy: PlainDate): PlainDate | null {
  return proximasFechas(validarRegla(regla), hoy, 1)[0] ?? null;
}

/**
 * O3: el ingreso principal como programado con `define_horizonte = 1`, desde hoy. Reemplaza al anterior (lo
 * desactiva) y apaga el modo ingreso variable.
 */
export function configurarIngreso(ctx: Contexto, entrada: EntradaIngreso): string {
  exigirConsentimiento(ctx);
  const e = validar(EntradaIngreso, entrada, 'ingreso_invalido');
  return enTransaccion(ctx, () => {
    desactivarIngresoPrincipal(ctx);
    marcarIngresoVariable(ctx, false);
    return insertarProgramado(ctx, {
      tipo: 'ingreso',
      concepto: e.concepto,
      monto: e.monto,
      regla: e.regla as Regla,
      desde: ctx.reloj.hoy(),
      cuentaId: e.cuentaId,
      categoriaCuentaId: idCategoriaDe(ctx, e.categoria, 'ingreso'),
      defineHorizonte: true,
    });
  });
}

/** O3 "Varía" o saltar: modo ingreso variable (E3.3 con 30 días). */
export function configurarIngresoVariable(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    desactivarIngresoPrincipal(ctx);
    marcarIngresoVariable(ctx, true);
  });
}

function desactivarIngresoPrincipal(ctx: Contexto): void {
  ctx.db
    .update(programado)
    .set({ activo: 0 })
    .where(and(eq(programado.defineHorizonte, 1), eq(programado.activo, 1)))
    .run();
}

// ——— O4 · Cuentas ———

export const EntradaCuenta = z.strictObject({
  subtipo: z.enum(['efectivo', 'debito', 'billetera', 'ahorro']),
  nombre: Nombre,
  saldo: Saldo,
  alias: z.array(z.string()).default([]),
  ultimos4: Ultimos4.optional(),
  institucion: z.string().optional(),
});
export type EntradaCuenta = z.input<typeof EntradaCuenta>;

/** O4: efectivo ("¿cuánto traes ahorita?"), débito, billetera o ahorro, con su saldo inicial. */
export function agregarCuenta(ctx: Contexto, entrada: EntradaCuenta): string {
  exigirConsentimiento(ctx);
  const e = validar(EntradaCuenta, entrada, 'cuenta_invalida');
  return enTransaccion(ctx, () => {
    const id = insertarCuenta(ctx, {
      naturaleza: 'activo',
      subtipo: e.subtipo,
      nombre: e.nombre,
      liquida: e.subtipo === 'ahorro' ? 0 : 1,
      ultimos4: e.ultimos4 ?? null,
      institucion: e.institucion ?? null,
      alias: [e.nombre, ...(e.subtipo === 'efectivo' ? ['efectivo'] : []), ...e.alias],
    });
    registrarSaldoInicial(ctx, id, e.saldo, ctx.reloj.hoy());
    return id;
  });
}

/** O4 mínimo: el efectivo. */
export function agregarEfectivo(ctx: Contexto, saldo: Centavos, nombre = 'Efectivo'): string {
  return agregarCuenta(ctx, { subtipo: 'efectivo', nombre, saldo });
}

const MsiPrevio = z.strictObject({
  mensualidad: Monto,
  restantes: z.int().min(1).max(48),
  descripcion: z.string().optional(),
});

/**
 * E6.1 plan que ya existía (caso 6c, E6-06): una subcuenta `msi` por compra con lo que falta, contra
 * `capital:saldos_iniciales`; la primera cuota en el primer corte estrictamente posterior a hoy.
 */
function registrarPlanesExistentes(
  ctx: Contexto,
  tarjetaId: string,
  nombreTarjeta: string,
  ciclo: TarjetaCredito,
  msiPrevios: readonly z.infer<typeof MsiPrevio>[],
  hoy: PlainDate,
): string[] {
  const primerCorte = corteDe(ciclo, sumarDias(hoy, 1));
  const yaHabia = ctx.db
    .select({ id: planMsi.id })
    .from(planMsi)
    .where(eq(planMsi.tarjetaId, tarjetaId))
    .all().length;
  return msiPrevios.map((m, i) => {
    const cuentaMsi = insertarCuenta(ctx, {
      naturaleza: 'pasivo',
      subtipo: 'msi',
      nombre: m.descripcion ?? `${nombreTarjeta} · meses ${yaHabia + i + 1}`,
      padreId: tarjetaId,
    });
    const mov = construirMsiExistente({
      cuentaMsi,
      capital: CUENTAS_SISTEMA.saldosIniciales,
      mensualidad: m.mensualidad,
      restantes: m.restantes,
    });
    const { transaccion } = ctx.libro.registrar({
      tipo: mov.tipo,
      fecha: hoy,
      origen: 'manual',
      claveIdempotencia: `saldo_inicial:${cuentaMsi}`,
      asientos: mov.asientos,
    });
    const planId = ctx.generarId();
    ctx.db
      .insert(planMsi)
      .values({
        id: planId,
        tarjetaId,
        cuentaMsiId: cuentaMsi,
        transaccionAltaId: transaccion.id,
        origenAlta: 'existente',
        monto: m.mensualidad * m.restantes,
        meses: m.restantes,
        fechaCompra: null,
        primerCorte,
      })
      .run();
    return planId;
  });
}

export const EntradaTarjeta = z
  .strictObject({
    nombre: Nombre,
    ultimos4: Ultimos4.optional(),
    institucion: z.string().optional(),
    alias: z.array(z.string()).default([]),
    diaCorte: z.int().min(1).max(31),
    diaLimitePago: z.int().min(1).max(31).optional(),
    diasParaPagar: z.int().min(1).max(60).optional(),
    limiteCredito: Monto,
    modo: z.enum(['totalero', 'plan']),
    /** "¿Cuánto debes hoy en esta tarjeta?" Obligatorio: sin saldo la tarjeta no se crea (`02 §3.1`). */
    saldo: Saldo,
    /** Compras a meses que ya tenías (E6-06). */
    msiPrevios: z.array(MsiPrevio).default([]),
    /** "¿El saldo que me diste ya incluye lo que te falta de esos meses?" */
    saldoIncluyeMsi: z.enum(['si', 'no', 'no_se']).optional(),
  })
  .refine((t) => (t.diaLimitePago === undefined) !== (t.diasParaPagar === undefined), {
    message: 'día límite o días para pagar, uno de los dos',
  })
  .refine((t) => t.msiPrevios.length === 0 || t.saldoIncluyeMsi !== undefined, {
    message: 'falta saber si el saldo incluye los meses',
  });
export type EntradaTarjeta = z.input<typeof EntradaTarjeta>;

export interface TarjetaCreada {
  readonly cuentaId: string;
  readonly planes: readonly string[];
  /** Deuda revolvente registrada (el saldo, menos los meses si "Sí, ya lo incluye"). */
  readonly saldoRevolvente: Centavos;
}

/**
 * O4 · tarjeta de crédito completa (`02 §3.1`): ciclo, límite, modo, saldo obligatorio y MSI que ya existían.
 * Con "Sí, ya lo incluye" los meses se restan del saldo; con "No" o "No sé" no (puede contar de más, nunca de
 * menos) y "No sé" deja un aviso de una sola vez en Hoy (CA-M2-12). `alta` = hoy (E5.3).
 */
export function agregarTarjetaCredito(ctx: Contexto, entrada: EntradaTarjeta): TarjetaCreada {
  exigirConsentimiento(ctx);
  const e = validar(EntradaTarjeta, entrada, 'tarjeta_invalida');
  const ciclo: TarjetaCredito =
    e.diasParaPagar !== undefined
      ? { diaCorte: e.diaCorte, diasParaPagar: e.diasParaPagar }
      : { diaCorte: e.diaCorte, diaLimitePago: e.diaLimitePago as number };
  validarTarjeta(ciclo);
  const hoy = ctx.reloj.hoy();
  const totalMsi = e.msiPrevios.reduce((s, m) => s + m.mensualidad * m.restantes, 0);
  const saldoRevolvente = e.saldoIncluyeMsi === 'si' ? Math.max(0, e.saldo - totalMsi) : e.saldo;

  return enTransaccion(ctx, () => {
    const cuentaId = insertarCuenta(ctx, {
      naturaleza: 'pasivo',
      subtipo: 'tarjeta_credito',
      nombre: e.nombre,
      ultimos4: e.ultimos4 ?? null,
      institucion: e.institucion ?? null,
      alias: [e.nombre, ...e.alias],
    });
    ctx.db
      .insert(tarjeta)
      .values({
        cuentaId,
        diaCorte: e.diaCorte,
        diasParaPagar: e.diasParaPagar ?? null,
        diaLimitePago: e.diaLimitePago ?? null,
        limiteCredito: e.limiteCredito,
        modo: e.modo,
        alta: hoy,
      })
      .run();
    registrarSaldoInicial(ctx, cuentaId, -saldoRevolvente, hoy);

    const planes = registrarPlanesExistentes(ctx, cuentaId, e.nombre, ciclo, e.msiPrevios, hoy);
    if (planes.length > 0 && e.saldoIncluyeMsi === 'no_se') crearAvisoMsiDoble(ctx, cuentaId, e.nombre);
    return { cuentaId, planes, saldoRevolvente };
  });
}

export const EntradaMsiQueYaTenia = z.strictObject({
  msiPrevios: z.array(MsiPrevio).min(1),
  /** "¿El saldo de esta tarjeta en la app ya incluye lo que te falta de esos meses?" */
  saldoIncluyeMsi: z.enum(['si', 'no', 'no_se']),
});
export type EntradaMsiQueYaTenia = z.input<typeof EntradaMsiQueYaTenia>;

export interface MsiAgregados {
  readonly planes: readonly string[];
  /** Deuda revolvente después de agregarlos (negativa = saldo a favor). */
  readonly saldoRevolvente: Centavos;
}

/**
 * "Agregar meses que ya tenía" en una tarjeta que ya existe (`02 §8`): las mismas reglas que en O4 (E6-06). Con
 * "Sí, ya lo incluye" lo que falta de esos meses sale de la deuda revolvente con una conciliación (caso 22), hasta
 * dejarla en cero: nunca crea saldo a favor. Con "No" o "No sé" la deuda no baja (puede contar de más, nunca de
 * menos) y "No sé" deja el aviso de una sola vez en Hoy.
 */
export function agregarMsiQueYaTenia(
  ctx: Contexto,
  tarjetaId: string,
  entrada: EntradaMsiQueYaTenia,
): MsiAgregados {
  exigirConsentimiento(ctx);
  const e = validar(EntradaMsiQueYaTenia, entrada, 'msi_invalido');
  return enTransaccion(ctx, () => {
    const t = tarjetaPorId(ctx, tarjetaId);
    const hoy = ctx.reloj.hoy();
    const planes = registrarPlanesExistentes(ctx, tarjetaId, t.nombre, t.ciclo, e.msiPrevios, hoy);
    let saldoRevolvente = t.saldoRevolvente;
    if (e.saldoIncluyeMsi === 'si') {
      const totalMsi = e.msiPrevios.reduce((s, m) => s + m.mensualidad * m.restantes, 0);
      const mover = Math.min(totalMsi, Math.max(0, t.saldoRevolvente));
      if (mover > 0) {
        const m = construirConciliacion({
          cuenta: tarjetaId,
          capital: CUENTAS_SISTEMA.ajusteConciliacion,
          saldoLibro: -t.saldoRevolvente,
          saldoReal: -(t.saldoRevolvente - mover),
        });
        ctx.libro.registrar({
          tipo: m.tipo,
          fecha: hoy,
          origen: 'manual',
          claveIdempotencia: `conciliacion:${ctx.generarId()}`,
          asientos: m.asientos,
        });
        saldoRevolvente = t.saldoRevolvente - mover;
      }
    }
    if (e.saldoIncluyeMsi === 'no_se') crearAvisoMsiDoble(ctx, tarjetaId, t.nombre);
    return { planes, saldoRevolvente };
  });
}

// ——— O5 · Pagos fijos ———

/** Chips de O5 (`02 §3`): luz, agua y gas son de monto variable. La tanda formal llega en M8. */
export const PAGOS_FIJOS_SUGERIDOS = [
  { clave: 'renta', concepto: 'renta', categoria: 'vivienda', variable: false },
  { clave: 'luz', concepto: 'luz', categoria: 'servicios', variable: true },
  { clave: 'agua', concepto: 'agua', categoria: 'servicios', variable: true },
  { clave: 'gas', concepto: 'gas', categoria: 'servicios', variable: true },
  { clave: 'internet', concepto: 'internet', categoria: 'servicios', variable: false },
  { clave: 'celular', concepto: 'celular', categoria: 'servicios', variable: false },
  { clave: 'gimnasio', concepto: 'gimnasio', categoria: 'deporte', variable: false },
  { clave: 'streaming', concepto: 'streaming', categoria: 'suscripciones', variable: false },
  { clave: 'tanda', concepto: 'tanda', categoria: null, variable: false },
] as const;

export const EntradaPagoFijo = z.strictObject({
  concepto: Nombre,
  monto: Monto,
  regla: z.unknown(),
  categoria: z.string().nullable().default(null),
  cuentaId: z.string().nullable().default(null),
  variable: z.boolean().default(false),
  hasta: z.string().nullable().default(null),
});
export type EntradaPagoFijo = Omit<z.input<typeof EntradaPagoFijo>, 'regla'> & { regla: Regla };

/** O5: un pago fijo como programado de egreso desde hoy (sus ocurrencias se materializan en Hoy). */
export function agregarPagoFijo(ctx: Contexto, entrada: EntradaPagoFijo): string {
  exigirConsentimiento(ctx);
  const e = validar(EntradaPagoFijo, entrada, 'pago_fijo_invalido');
  return enTransaccion(ctx, () =>
    insertarProgramado(ctx, {
      tipo: 'egreso',
      concepto: e.concepto,
      monto: e.monto,
      regla: validarRegla(e.regla),
      desde: ctx.reloj.hoy(),
      hasta: e.hasta,
      cuentaId: e.cuentaId,
      categoriaCuentaId: e.categoria ? idCategoriaDe(ctx, e.categoria, 'gasto') : null,
      variable: e.variable,
    }),
  );
}

/** O5: quita un pago fijo recién agregado (lo desactiva; sus ocurrencias dejan de apartarse en E4). */
export function quitarPagoFijo(ctx: Contexto, programadoId: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => desactivarProgramado(ctx, programadoId));
}
