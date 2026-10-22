import { construirConciliacion, type Centavos, type PlainDate, type Regla } from '@cartera/core';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { normalizarAlias } from '@cartera/nlu';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { fijarColchon, obtenerColchon } from './ajustes';
import { cuentasPropias } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { configurarIngreso, EntradaIngreso, proximoPago } from './onboarding';
import { ingresoPrincipal } from './programados';

/** «Mi colchón es de 2 mil» (`06 §9.2`): aplicado al momento, con Deshacer que regresa al anterior. */
export interface ColchonDicho {
  readonly resultado: 'colchon_configurado';
  readonly monto: Centavos;
  readonly anterior: Centavos;
  /** Token de Deshacer: `k:<anterior>`. */
  readonly deshacer: string;
}

export function configurarColchonDicho(ctx: Contexto, monto: Centavos): ColchonDicho {
  exigirConsentimiento(ctx);
  const anterior = obtenerColchon(ctx);
  fijarColchon(ctx, monto);
  return { resultado: 'colchon_configurado', monto, anterior, deshacer: `k:${anterior}` };
}

/** Deshacer de `configurarColchonDicho`. */
export function deshacerColchon(ctx: Contexto, anterior: string): void {
  const monto = Number(anterior);
  if (Number.isSafeInteger(monto) && monto >= 0) fijarColchon(ctx, monto);
}

/**
 * «Me pagan 8 mil cada quincena, el 15 y el último»: cambia el ingreso que define el horizonte, así que nunca se
 * aplica solo. La tarjeta muestra lo entendido junto al ingreso de hoy y guarda con `confirmarIngresoDicho`.
 */
export interface PropuestaIngreso {
  readonly monto: Centavos;
  readonly regla: Regla;
  readonly proximo: PlainDate | null;
  /** El ingreso que se reemplaza, si había uno. */
  readonly anterior: { readonly monto: Centavos; readonly regla: Regla } | null;
}

/** `null` si la regla no sirve para un ingreso (p. ej. una fecha única). */
export function proponerIngresoDicho(
  ctx: Contexto,
  dicho: { readonly monto: Centavos; readonly regla: Regla },
): PropuestaIngreso | null {
  const valida = EntradaIngreso.safeParse({ monto: dicho.monto, regla: dicho.regla });
  if (!valida.success) return null;
  const actual = ingresoPrincipal(ctx);
  return {
    monto: dicho.monto,
    regla: dicho.regla,
    proximo: proximoPago(dicho.regla, ctx.reloj.hoy()),
    anterior: actual ? { monto: actual.monto, regla: actual.regla } : null,
  };
}

export function confirmarIngresoDicho(ctx: Contexto, propuesta: PropuestaIngreso): string {
  return configurarIngreso(ctx, {
    concepto: conceptoDeRegla(propuesta.regla),
    monto: propuesta.monto,
    regla: propuesta.regla,
  });
}

/** El mismo concepto que O3 (`conceptoIngreso`), desde la regla. */
function conceptoDeRegla(regla: Regla): string {
  if (regla.tipo.startsWith('quincenal')) return 'quincena';
  if (regla.tipo === 'semanal') return 'semana';
  return 'sueldo';
}

/**
 * «Tengo 4,200 en BBVA» (`04 §6` caso 22): el saldo que dices de una cuenta de débito, billetera o ahorro. Nunca se
 * aplica solo: la tarjeta muestra lo que llevo y lo que dices, y «Ajustar» registra la `conciliacion`.
 */
export interface PropuestaSaldo {
  readonly cuentaId: string;
  readonly nombre: string;
  readonly saldoLibro: Centavos;
  readonly saldoReal: Centavos;
}

export type SaldoDicho =
  | { readonly resultado: 'saldo_por_confirmar'; readonly propuesta: PropuestaSaldo }
  | { readonly resultado: 'saldo_sin_cambio'; readonly nombre: string; readonly monto: Centavos }
  /** El efectivo se corrige con el arqueo (`02 §7`), que reparte el hueco en gastos. */
  | { readonly resultado: 'arqueo'; readonly efectivoReal: Centavos };

/** `null` si ninguna cuenta (o más de una) tiene ese alias. */
export function proponerSaldoDicho(ctx: Contexto, alias: string, monto: Centavos): SaldoDicho | null {
  exigirConsentimiento(ctx);
  const buscado = normalizarAlias(alias);
  if (buscado === '') return null;
  const coinciden = cuentasPropias(ctx).filter(
    (c) => SUBTIPOS_CON_SALDO.has(c.subtipo) && c.alias.some((a) => normalizarAlias(a) === buscado),
  );
  const [unica] = coinciden;
  if (!unica || coinciden.length > 1) return null;
  if (unica.subtipo === 'efectivo') return { resultado: 'arqueo', efectivoReal: monto };
  const saldoLibro = ctx.libro.saldo(unica.id);
  if (saldoLibro === monto) return { resultado: 'saldo_sin_cambio', nombre: unica.nombre, monto };
  return {
    resultado: 'saldo_por_confirmar',
    propuesta: { cuentaId: unica.id, nombre: unica.nombre, saldoLibro, saldoReal: monto },
  };
}

const SUBTIPOS_CON_SALDO = new Set<string>(['efectivo', 'debito', 'billetera', 'ahorro']);

/** «Ajustar»: la diferencia contra `capital:ajuste_conciliacion`, fechada hoy. */
export function confirmarSaldoDicho(
  ctx: Contexto,
  p: PropuestaSaldo,
  origen: 'voz' | 'texto' = 'voz',
): string | null {
  exigirConsentimiento(ctx);
  return enTransaccion(ctx, () => {
    const saldoLibro = ctx.libro.saldo(p.cuentaId);
    if (saldoLibro === p.saldoReal) return null;
    const m = construirConciliacion({
      cuenta: p.cuentaId,
      capital: CUENTAS_SISTEMA.ajusteConciliacion,
      saldoReal: p.saldoReal,
      saldoLibro,
    });
    const { transaccion } = ctx.libro.registrar({
      tipo: m.tipo,
      fecha: ctx.reloj.hoy(),
      origen,
      claveIdempotencia: `conciliacion:${ctx.generarId()}`,
      asientos: m.asientos,
    });
    return transaccion.id;
  });
}
