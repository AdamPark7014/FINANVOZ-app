import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  compromisoPorMes,
  construirCompraMsi,
  construirLiquidacionMsi,
  corteDe,
  ErrorDominio,
  esFecha,
  siguienteCorte,
  sumarMeses,
  type Centavos,
  type PlainDate,
} from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, idCategoriaDe, insertarCuenta } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { recalcularCortesDesde, reclasificarCuotasHasta, ultimoCorteCerrado } from './cortes';
import { liberarOcurrencias } from './cobertura';
import { borrarAjuste, escribirAjuste, listarAjustes } from './preferencias';
import {
  cuotasDePlan,
  cuotasMsiPendientes,
  planesVigentes,
  tarjetaPorId,
  tarjetasActivas,
  type CuotaPlan,
  type EstadoPlan,
  type PlanLeido,
} from './tarjetas';

const { planMsi, transaccion, asiento, cuenta } = esquema;

const Fecha = z.string().refine(esFecha, 'fecha inválida');

// ——— Alta de una compra a meses (E6.1, E6.2 caso 6a) ———

export const EntradaCompraMsi = z.strictObject({
  /** Cuenta de la tarjeta de crédito. */
  tarjetaId: z.string().min(1),
  monto: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  /** Compra nueva: 2 a 48 meses (`04 §3`). */
  meses: z.int().min(2).max(48),
  fecha: Fecha.optional(),
  categoria: z.string().min(1).default('otros_gastos'),
  descripcion: z.string().trim().min(1).max(200).optional(),
  comercio: z.string().trim().min(1).max(200).optional(),
  /** Supuesto a validar por banco: 0 (pendiente 2). */
  mesesDiferimiento: z.int().min(0).max(12).default(0),
});
export type EntradaCompraMsi = z.input<typeof EntradaCompraMsi>;

export interface CompraMsiRegistrada {
  readonly planId: string;
  readonly transaccionId: string;
  readonly tarjetaId: string;
  readonly tarjeta: string;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly meses: number;
  readonly categoria: string;
  readonly fecha: PlainDate;
  /** Calendario de cuotas (corte y fecha límite de cada una). */
  readonly cuotas: readonly CuotaPlan[];
  /** Compromiso por mes de fecha límite (`'YYYY-MM'` → centavos), E6.1. */
  readonly compromisoPorMes: Readonly<Record<string, Centavos>>;
  /** Token de "Deshacer": anula la compra y el plan deja de existir. */
  readonly deshacer: string;
}

function exigirTarjeta(ctx: Contexto, tarjetaId: string) {
  const fila = cuentaPorId(ctx, tarjetaId);
  if (fila.subtipo !== 'tarjeta_credito') {
    throw new ErrorDominio('meses_sin_tarjeta', 'solo una compra con tarjeta de crédito va a meses');
  }
  return tarjetaPorId(ctx, tarjetaId);
}

function crearCuentaMsi(ctx: Contexto, tarjetaId: string, descripcion: string): string {
  return insertarCuenta(ctx, {
    naturaleza: 'pasivo',
    subtipo: 'msi',
    nombre: descripcion,
    padreId: tarjetaId,
  });
}

function insertarPlan(
  ctx: Contexto,
  datos: {
    tarjetaId: string;
    cuentaMsiId: string;
    transaccionAltaId: string;
    origenAlta: 'compra' | 'pasar_a_meses';
    monto: Centavos;
    meses: number;
    mesesDiferimiento: number;
    fechaCompra: PlainDate;
    primerCorte: PlainDate;
  },
): string {
  const id = ctx.generarId();
  ctx.db
    .insert(planMsi)
    .values({ id, ...datos })
    .run();
  return id;
}

/** Primer corte de una compra nueva: `corteDe(fecha)` avanzado `meses_diferimiento` cortes (E6.1). */
function primerCorteDe(ctx: Contexto, tarjetaId: string, fecha: PlainDate, diferimiento: number): PlainDate {
  const { ciclo } = tarjetaPorId(ctx, tarjetaId);
  let c = corteDe(ciclo, fecha);
  for (let i = 0; i < diferimiento; i++) c = siguienteCorte(ciclo, c);
  return c;
}

/**
 * Si la compra es de un periodo que ya se cerró, sus cuotas de esos cortes se facturan de una vez (con la fecha
 * de su corte) y los estados de cuenta desde la compra se recalculan: así lo que se debe no queda de menos.
 */
function ponerAlCorriente(ctx: Contexto, tarjetaId: string, fecha: PlainDate): void {
  const ultimo = ultimoCorteCerrado(ctx, tarjetaId);
  if (!ultimo || ultimo < fecha) return;
  reclasificarCuotasHasta(ctx, tarjetaPorId(ctx, tarjetaId), ultimo);
  recalcularCortesDesde(ctx, tarjetaId, fecha);
}

function registrada(ctx: Contexto, planId: string, deshacer: string): CompraMsiRegistrada {
  const plan = planesVigentes(ctx).find((p) => p.id === planId);
  if (!plan) throw new ErrorDominio('plan_inexistente', 'ese plan no existe');
  const t = tarjetaPorId(ctx, plan.tarjetaId);
  const cuotas = cuotasDePlan(ctx, plan, t.ciclo);
  const categoria = ctx.db
    .select({ nombre: cuenta.nombre, naturaleza: cuenta.naturaleza })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(eq(asiento.transaccionId, plan.transaccionAltaId))
    .all()
    .find((a) => a.naturaleza === 'gasto');
  return {
    planId,
    transaccionId: plan.transaccionAltaId,
    tarjetaId: t.cuentaId,
    tarjeta: t.nombre,
    descripcion: plan.descripcion,
    monto: plan.monto,
    meses: plan.meses,
    categoria: categoria?.nombre ?? '',
    fecha: plan.fechaCompra as PlainDate,
    cuotas,
    compromisoPorMes: compromisoPorMes(cuotas),
    deshacer,
  };
}

/**
 * "Compré una tele de 12 mil a 12 meses sin intereses con la Oro" (CA-M4-06, `04 §4` caso 6a): el gasto completo
 * en su categoría el día de la compra (`gasto +` / `msi −`), la subcuenta MSI de la tarjeta y el plan con su
 * calendario (E6.1). E4 solo reserva las cuotas que vencen en el horizonte.
 */
export function registrarCompraMsi(
  ctx: Contexto,
  entrada: EntradaCompraMsi,
  opciones: { origen?: 'manual' | 'voz' | 'texto'; claveIdempotencia?: string } = {},
): CompraMsiRegistrada {
  exigirConsentimiento(ctx);
  const r = EntradaCompraMsi.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('compra_msi_invalida', 'revisa los datos de la compra a meses');
  const e = r.data;
  const fecha = e.fecha ?? ctx.reloj.hoy();
  return enTransaccion(ctx, () => {
    const t = exigirTarjeta(ctx, e.tarjetaId);
    const categoriaId = idCategoriaDe(ctx, e.categoria, 'gasto');
    const descripcion = e.descripcion ?? `${cuentaPorId(ctx, categoriaId).nombre} a ${e.meses} meses`;
    const cuentaMsiId = crearCuentaMsi(ctx, t.cuentaId, descripcion);
    const mov = construirCompraMsi({ categoria: categoriaId, cuentaMsi: cuentaMsiId, monto: e.monto });
    const { transaccion: tx } = ctx.libro.registrar({
      tipo: mov.tipo,
      fecha,
      origen: opciones.origen ?? 'manual',
      claveIdempotencia: opciones.claveIdempotencia ?? `msi_compra:${ctx.generarId()}`,
      asientos: mov.asientos,
      descripcion: e.descripcion ?? null,
      comercio: e.comercio ?? null,
    });
    const planId = insertarPlan(ctx, {
      tarjetaId: t.cuentaId,
      cuentaMsiId,
      transaccionAltaId: tx.id,
      origenAlta: 'compra',
      monto: e.monto,
      meses: e.meses,
      mesesDiferimiento: e.mesesDiferimiento,
      fechaCompra: fecha,
      primerCorte: primerCorteDe(ctx, t.cuentaId, fecha, e.mesesDiferimiento),
    });
    ponerAlCorriente(ctx, t.cuentaId, fecha);
    return registrada(ctx, planId, tx.id);
  });
}

// ——— Pasar a meses (E6.2, caso 6d) ———

export interface PasadoAMeses extends CompraMsiRegistrada {
  /** El cargo que se reemplazó. */
  readonly originalId: string;
}

/**
 * "Ese cargo de 12,000 fue a 12 meses" (CA-M4-09, `04 §4` caso 6d): `Libro.reemplazar` cambia el cargo normal
 * (`gasto +` / tarjeta `−`) por la compra MSI con el mismo monto, fecha, categoría y descripción. La deuda
 * revolvente vuelve a como estaba antes del cargo, el plan se crea y el gasto aparece una sola vez. Las
 * ocurrencias que cubría el cargo vuelven a pendiente (una compra a meses no cubre un pago fijo).
 */
export function pasarAMeses(
  ctx: Contexto,
  transaccionId: string,
  meses: number,
  opciones: { origen?: 'manual' | 'voz' | 'texto' } = {},
): PasadoAMeses {
  exigirConsentimiento(ctx);
  if (!Number.isSafeInteger(meses) || meses < 2 || meses > 48) {
    throw new ErrorDominio('meses_invalidos', 'los meses van de 2 a 48');
  }
  return enTransaccion(ctx, () => {
    const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, transaccionId)).get();
    if (!fila) throw new ErrorDominio('transaccion_inexistente', 'no existe ese movimiento');
    const anulada = ctx.db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.revierteA, transaccionId))
      .get();
    if (anulada) throw new ErrorDominio('ya_anulada', 'ese movimiento ya no está');
    const asientos = ctx.db
      .select({
        cuentaId: asiento.cuentaId,
        monto: asiento.monto,
        naturaleza: cuenta.naturaleza,
        subtipo: cuenta.subtipo,
      })
      .from(asiento)
      .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
      .where(eq(asiento.transaccionId, transaccionId))
      .all();
    const gasto = asientos.find((a) => a.naturaleza === 'gasto' && a.monto > 0);
    const cargo = asientos.find((a) => a.subtipo === 'tarjeta_credito' && a.monto < 0);
    if (fila.tipo !== 'gasto' || asientos.length !== 2 || !gasto || !cargo) {
      throw new ErrorDominio('meses_sin_tarjeta', 'solo una compra con tarjeta de crédito pasa a meses');
    }
    const t = exigirTarjeta(ctx, cargo.cuentaId);
    const nombreCategoria = cuentaPorId(ctx, gasto.cuentaId).nombre;
    const descripcion = fila.descripcion ?? fila.comercio ?? `${nombreCategoria} a ${meses} meses`;
    const cuentaMsiId = crearCuentaMsi(ctx, t.cuentaId, descripcion);
    const mov = construirCompraMsi({ categoria: gasto.cuentaId, cuentaMsi: cuentaMsiId, monto: gasto.monto });
    const r = ctx.libro.reemplazar(transaccionId, {
      tipo: mov.tipo,
      fecha: fila.fecha,
      origen: opciones.origen ?? 'manual',
      claveIdempotencia: `pasar_a_meses:${transaccionId}`,
      asientos: mov.asientos,
      descripcion: fila.descripcion,
      comercio: fila.comercio,
      meta: fila.meta,
    });
    liberarOcurrencias(ctx, transaccionId);
    const planId = insertarPlan(ctx, {
      tarjetaId: t.cuentaId,
      cuentaMsiId,
      transaccionAltaId: r.nueva.id,
      origenAlta: 'pasar_a_meses',
      monto: gasto.monto,
      meses,
      mesesDiferimiento: 0,
      fechaCompra: fila.fecha,
      primerCorte: primerCorteDe(ctx, t.cuentaId, fila.fecha, 0),
    });
    borrarAjuste(ctx, claveIntencion(transaccionId));
    ponerAlCorriente(ctx, t.cuentaId, fila.fecha);
    // Deshacer = volver a poner el cargo original (`deshacerPasarAMeses`).
    return { ...registrada(ctx, planId, `m:${r.nueva.id}:${transaccionId}`), originalId: transaccionId };
  });
}

/**
 * Anula las cuotas ya facturadas del plan que dio de alta `altaId` (si la compra a meses se anula o se deshace,
 * sus cuotas tampoco existieron) y recalcula los estados de cuenta afectados. Devuelve el plan o `null`.
 */
export function anularCuotasDelPlan(ctx: Contexto, altaId: string): void {
  const plan = ctx.db.select().from(planMsi).where(eq(planMsi.transaccionAltaId, altaId)).get();
  if (!plan) return;
  const claves = Array.from({ length: plan.meses }, (_, i) => `msi:${plan.id}:${i + 1}`);
  let desde: PlainDate | null = null;
  for (const clave of claves) {
    const tx = ctx.db.select().from(transaccion).where(eq(transaccion.claveIdempotencia, clave)).get();
    if (!tx) continue;
    const anulada = ctx.db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.revierteA, tx.id))
      .get();
    if (anulada) continue;
    ctx.libro.anular(tx.id);
    if (desde === null || tx.fecha < desde) desde = tx.fecha;
  }
  if (desde) recalcularCortesDesde(ctx, plan.tarjetaId, desde);
}

/**
 * "Deshacer" de la anulación de una compra a meses: el plan vuelve a apuntar a la compra restaurada y sus cuotas
 * ya facturadas (que se anularon con ella) se registran de nuevo.
 */
export function restaurarPlanDe(ctx: Contexto, altaAnuladaId: string, nuevaAltaId: string): void {
  const plan = ctx.db.select().from(planMsi).where(eq(planMsi.transaccionAltaId, altaAnuladaId)).get();
  if (!plan) return;
  ctx.db.update(planMsi).set({ transaccionAltaId: nuevaAltaId }).where(eq(planMsi.id, plan.id)).run();
  let desde: PlainDate | null = null;
  for (let k = 1; k <= plan.meses; k++) {
    const tx = ctx.db
      .select()
      .from(transaccion)
      .where(eq(transaccion.claveIdempotencia, `msi:${plan.id}:${k}`))
      .get();
    if (!tx) continue;
    const anulada = ctx.db
      .select({ id: transaccion.id })
      .from(transaccion)
      .where(eq(transaccion.revierteA, tx.id))
      .get();
    if (!anulada) continue;
    const asientos = ctx.db
      .select({ cuentaId: asiento.cuentaId, monto: asiento.monto })
      .from(asiento)
      .where(eq(asiento.transaccionId, tx.id))
      .all();
    const r = ctx.libro.registrar({
      tipo: 'reclasificacion_msi',
      fecha: tx.fecha,
      origen: 'sistema',
      claveIdempotencia: `restaura:${tx.id}`,
      asientos,
      descripcion: tx.descripcion,
    });
    if (r.nueva && (desde === null || tx.fecha < desde)) desde = tx.fecha;
  }
  if (desde) recalcularCortesDesde(ctx, plan.tarjetaId, desde);
}

/** "Deshacer" de pasar a meses: vuelve a poner el cargo original y anula las cuotas que se hubieran facturado. */
export function deshacerPasarAMeses(ctx: Contexto, msiId: string, originalId: string): string {
  return enTransaccion(ctx, () => {
    anularCuotasDelPlan(ctx, msiId);
    const fila = ctx.db.select().from(transaccion).where(eq(transaccion.id, originalId)).get();
    if (!fila) throw new ErrorDominio('transaccion_inexistente', 'no existe ese movimiento');
    const asientos = ctx.db
      .select({ cuentaId: asiento.cuentaId, monto: asiento.monto })
      .from(asiento)
      .where(eq(asiento.transaccionId, originalId))
      .all();
    const r = ctx.libro.reemplazar(msiId, {
      tipo: 'gasto',
      fecha: fila.fecha,
      origen: fila.origen as 'manual',
      claveIdempotencia: `restaura:${originalId}:${msiId}`,
      asientos,
      descripcion: fila.descripcion,
      comercio: fila.comercio,
      meta: fila.meta,
    });
    recalcularCortesDesde(ctx, cuentaDelCargo(asientos), fila.fecha);
    return r.nueva.id;
  });
}

function cuentaDelCargo(asientos: readonly { cuentaId: string; monto: number }[]): string {
  return asientos.find((a) => a.monto < 0)?.cuentaId as string;
}

const IntencionMeses = z.strictObject({ meses: z.int().min(2).max(48), registrado_en: z.int() });
const PREFIJO_INTENCION = 'pasar_a_meses:';
const claveIntencion = (id: string) => `${PREFIJO_INTENCION}${id}`;

/**
 * Convierte en planes las intenciones "pasar a meses" que M3 guardó en `ajuste` (`pasar_a_meses:<id>`). Las que
 * ya no aplican (movimiento anulado o que no es compra con tarjeta) se descartan. Idempotente.
 */
export function procesarIntencionesMeses(ctx: Contexto): PasadoAMeses[] {
  const hechos: PasadoAMeses[] = [];
  for (const { clave, valor } of listarAjustes(ctx, PREFIJO_INTENCION, IntencionMeses)) {
    const id = clave.slice(PREFIJO_INTENCION.length);
    try {
      hechos.push(pasarAMeses(ctx, id, valor.meses));
    } catch (error) {
      if (!(error instanceof ErrorDominio)) throw error;
      borrarAjuste(ctx, clave);
    }
  }
  return hechos;
}

// ——— Liquidar MSI por adelantado (E6.2, caso 6e) ———

export interface PlanPorLiquidar {
  readonly planId: string;
  readonly descripcion: string;
  /** Lo que falta del plan. */
  readonly restante: Centavos;
}

/** "¿Este pago fue para liquidar tus meses?" (`02 §8`, CA-M4-10). */
export interface PreguntaLiquidar {
  readonly tarjetaId: string;
  readonly tarjeta: string;
  readonly pregunta: string;
  /** Saldo a favor que dejó el pago (nunca sube el "hoy puedes", E4-07). */
  readonly saldoAFavor: Centavos;
  /** Un chip por plan ("Sí, la tele") y "No". */
  readonly planes: readonly PlanPorLiquidar[];
}

const PreguntaGuardada = z.strictObject({ transaccion_id: z.string() });
const PREFIJO_LIQUIDAR = 'pregunta_liquidar:';

function planesConRestante(ctx: Contexto, tarjetaId: string): PlanPorLiquidar[] {
  return planesVigentes(ctx, { tarjetaId, estados: ['activo'] })
    .map((p) => ({ planId: p.id, descripcion: p.descripcion, restante: 0 - ctx.libro.saldo(p.cuentaMsiId) }))
    .filter((p) => p.restante > 0);
}

function pregunta(ctx: Contexto, tarjetaId: string): PreguntaLiquidar | null {
  const t = tarjetaPorId(ctx, tarjetaId);
  if (t.saldoRevolvente >= 0) return null;
  const planes = planesConRestante(ctx, tarjetaId);
  if (planes.length === 0) return null;
  return {
    tarjetaId,
    tarjeta: t.nombre,
    pregunta: '¿Este pago fue para liquidar tus meses?',
    saldoAFavor: -t.saldoRevolvente,
    planes,
  };
}

/**
 * Tras registrar un pago a una tarjeta: si dejó saldo a favor y la tarjeta tiene meses activos, guarda la
 * pregunta (Hoy la muestra hasta que se conteste) y la devuelve. `null` si no aplica.
 */
export function preguntaTrasPago(
  ctx: Contexto,
  tarjetaId: string,
  transaccionId: string,
): PreguntaLiquidar | null {
  const p = pregunta(ctx, tarjetaId);
  if (p)
    escribirAjuste(ctx, `${PREFIJO_LIQUIDAR}${tarjetaId}`, PreguntaGuardada, {
      transaccion_id: transaccionId,
    });
  return p;
}

/** Preguntas de liquidar pendientes que todavía aplican (las que ya no, se descartan). */
export function preguntasLiquidarPendientes(ctx: Contexto): PreguntaLiquidar[] {
  const salida: PreguntaLiquidar[] = [];
  for (const { clave } of listarAjustes(ctx, PREFIJO_LIQUIDAR, PreguntaGuardada)) {
    const tarjetaId = clave.slice(PREFIJO_LIQUIDAR.length);
    let p: PreguntaLiquidar | null = null;
    try {
      p = pregunta(ctx, tarjetaId);
    } catch (error) {
      if (!(error instanceof ErrorDominio)) throw error;
    }
    if (p) salida.push(p);
  }
  return salida;
}

/** "No" a la pregunta: el saldo a favor se queda como está (y sigue sin sumar al dinero libre). */
export function noEraParaLiquidar(ctx: Contexto, tarjetaId: string): void {
  exigirConsentimiento(ctx);
  borrarAjuste(ctx, `${PREFIJO_LIQUIDAR}${tarjetaId}`);
}

export interface PlanLiquidado {
  readonly planId: string;
  readonly transaccionId: string;
  readonly monto: Centavos;
  readonly deshacer: string;
}

/**
 * Liquidar un plan por adelantado (`04 §4` caso 6e): `msi +restante` / tarjeta `−restante` y el plan queda
 * `liquidado`: sus cuotas ya no se generan ni se reservan. Contesta la pregunta pendiente de esa tarjeta.
 */
export function liquidarMsi(ctx: Contexto, planId: string): PlanLiquidado {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const plan = planesVigentes(ctx).find((p) => p.id === planId);
    if (!plan) throw new ErrorDominio('plan_inexistente', 'ese plan no existe');
    if (plan.estado !== 'activo') throw new ErrorDominio('plan_no_activo', 'ese plan ya no está activo');
    const restante = 0 - ctx.libro.saldo(plan.cuentaMsiId);
    if (restante <= 0) throw new ErrorDominio('plan_sin_saldo', 'a ese plan ya no le falta nada');
    const mov = construirLiquidacionMsi({
      cuentaMsi: plan.cuentaMsiId,
      tarjeta: plan.tarjetaId,
      monto: restante,
    });
    const { transaccion: tx } = ctx.libro.registrar({
      tipo: mov.tipo,
      fecha: ctx.reloj.hoy(),
      origen: 'manual',
      claveIdempotencia: `liquidacion_msi:${plan.id}:${ctx.generarId()}`,
      asientos: mov.asientos,
      descripcion: plan.descripcion,
    });
    ctx.db.update(planMsi).set({ estado: 'liquidado' }).where(eq(planMsi.id, plan.id)).run();
    borrarAjuste(ctx, `${PREFIJO_LIQUIDAR}${plan.tarjetaId}`);
    return { planId: plan.id, transaccionId: tx.id, monto: restante, deshacer: `l:${plan.id}:${tx.id}` };
  });
}

/** "Deshacer" de una liquidación: anula su transacción y el plan vuelve a estar activo. */
export function deshacerLiquidacion(ctx: Contexto, planId: string, transaccionId: string): void {
  enTransaccion(ctx, () => {
    ctx.libro.anular(transaccionId);
    ctx.db.update(planMsi).set({ estado: 'activo' }).where(eq(planMsi.id, planId)).run();
  });
}

// ——— Vistas ———

export interface PlanMsiVista {
  readonly id: string;
  readonly tarjetaId: string;
  readonly descripcion: string;
  readonly origen: 'compra' | 'existente' | 'pasar_a_meses';
  readonly estado: EstadoPlan;
  readonly monto: Centavos;
  readonly meses: number;
  readonly fechaCompra: PlainDate | null;
  /** Cuota del próximo corte (o la primera si no queda ninguna). */
  readonly cuota: Centavos;
  readonly cuotasRestantes: number;
  /** Lo que falta (saldo de la subcuenta: incluye cuotas ya facturadas en la deuda revolvente, no). */
  readonly restante: Centavos;
  /** Mes (`'YYYY-MM'`) de la fecha límite de la última cuota por facturar; `null` si ya no queda ninguna. */
  readonly terminaEn: string | null;
  readonly cuotas: readonly CuotaPlan[];
}

export function vistaPlan(ctx: Contexto, plan: PlanLeido): PlanMsiVista {
  const cuotas = cuotasDePlan(ctx, plan);
  const pendientes = cuotas.filter((c) => c.estado === 'por_facturar');
  const ultima = pendientes[pendientes.length - 1];
  return {
    id: plan.id,
    tarjetaId: plan.tarjetaId,
    descripcion: plan.descripcion,
    origen: plan.origenAlta,
    estado: plan.estado,
    monto: plan.monto,
    meses: plan.meses,
    fechaCompra: plan.fechaCompra,
    cuota: (pendientes[0] ?? cuotas[0])?.monto ?? 0,
    cuotasRestantes: pendientes.length,
    restante: 0 - ctx.libro.saldo(plan.cuentaMsiId),
    terminaEn: ultima ? ultima.limite.slice(0, 7) : null,
    cuotas,
  };
}

/** Planes MSI de una tarjeta (o de todas): activos primero, luego los terminados y liquidados. */
export function listarPlanesMsi(ctx: Contexto, tarjetaId?: string): PlanMsiVista[] {
  const orden: Record<EstadoPlan, number> = { activo: 0, terminado: 1, liquidado: 2 };
  return planesVigentes(ctx, tarjetaId ? { tarjetaId } : {})
    .sort((a, b) => orden[a.estado] - orden[b.estado])
    .map((p) => vistaPlan(ctx, p));
}

export interface MesCompromiso {
  /** `'YYYY-MM'` */
  readonly mes: string;
  readonly monto: Centavos;
}

/**
 * Compromiso de meses sin intereses de los próximos 12 meses (RF-TAR-04): cuotas por facturar agrupadas por el
 * mes de su fecha límite (E6.1 `compromisoPorMes`), del mes en curso a 11 meses después, incluidos los meses
 * en cero.
 */
export function compromisoMsi12Meses(ctx: Contexto, tarjetaId?: string): MesCompromiso[] {
  const porMes = compromisoPorMes(cuotasMsiPendientes(ctx, tarjetaId));
  const inicio = `${ctx.reloj.hoy().slice(0, 7)}-01`;
  const salida: MesCompromiso[] = [];
  let acumuladoAntes = 0;
  for (const [mes, monto] of Object.entries(porMes)) if (`${mes}-01` < inicio) acumuladoAntes += monto;
  for (let i = 0; i < 12; i++) {
    const mes = sumarMeses(inicio, i).slice(0, 7);
    // Lo vencido sin facturar se suma al mes en curso (sigue debiéndose).
    salida.push({ mes, monto: (porMes[mes] ?? 0) + (i === 0 ? acumuladoAntes : 0) });
  }
  return salida;
}

/** Tarjetas activas con algún plan vigente activo (para "Liquidar meses" en la pantalla Tarjetas). */
export function tarjetasConMeses(ctx: Contexto): string[] {
  const conPlan = new Set(planesVigentes(ctx, { estados: ['activo'] }).map((p) => p.tarjetaId));
  return tarjetasActivas(ctx)
    .map((t) => t.cuentaId)
    .filter((id) => conPlan.has(id));
}
