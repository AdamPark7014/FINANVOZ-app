import { and, asc, eq } from 'drizzle-orm';
import { sumarDias, type Centavos, type PlainDate } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { fechaUltimoArqueo } from './arqueo';
import { cuentasPropias, type SubtipoPropio } from './catalogo';
import type { Contexto } from './contexto';
import { listarOcurrencias, materializarOcurrencias } from './ocurrencias';
import { listarPersonas } from './personas';
import { tarjetasActivas } from './tarjetas';

const { cuenta } = esquema;

export interface CuentaTienes {
  readonly id: string;
  readonly nombre: string;
  readonly subtipo: Exclude<SubtipoPropio, 'tarjeta_credito'>;
  readonly ultimos4: string | null;
  readonly saldo: Centavos;
  /** Efectivo: cuándo lo contaste por última vez (B+, D6); `null` si nunca o si no es efectivo. */
  readonly contadaEl: PlainDate | null;
}

export interface CuentaDebes {
  readonly id: string;
  readonly tipo: 'tarjeta' | 'persona';
  readonly nombre: string;
  readonly ultimos4: string | null;
  /** Lo que debes: tarjeta = revolvente (negativo = saldo a favor); persona = le debes. */
  readonly saldo: Centavos;
  /** Tarjeta: lo que falta de meses sin intereses. */
  readonly meses: Centavos;
  readonly limiteCredito: Centavos | null;
  /** Persona: interruptor "Apartar lo que le debo". */
  readonly apartar: boolean | null;
}

export interface PersonaTeDebe {
  readonly id: string;
  readonly nombre: string;
  readonly saldo: Centavos;
}

export interface CompromisoProximo {
  readonly programadoId: string;
  readonly concepto: string;
  readonly fecha: PlainDate;
  readonly monto: Centavos;
}

/** «Lo que viene» como línea de tiempo (B+, D6): pagos fijos e ingresos de los próximos 30 días, por fecha. */
export interface ProximoMovimiento extends CompromisoProximo {
  readonly tipo: 'egreso' | 'ingreso';
}

/** Cuentas (`02 §11`): Tienes · Debes · Te deben · Compromisos (próximos 30 días). */
export interface VistaCuentas {
  readonly tienes: readonly CuentaTienes[];
  readonly debes: readonly CuentaDebes[];
  readonly teDeben: readonly PersonaTeDebe[];
  readonly compromisos: readonly CompromisoProximo[];
  /** Los compromisos y los ingresos pendientes de los próximos 30 días, juntos y por fecha (los ingresos primero). */
  readonly loQueViene: readonly ProximoMovimiento[];
}

function mesesDe(ctx: Contexto, tarjetaId: string): Centavos {
  return ctx.db
    .select({ id: cuenta.id })
    .from(cuenta)
    .where(and(eq(cuenta.padreId, tarjetaId), eq(cuenta.subtipo, 'msi')))
    .orderBy(asc(cuenta.id))
    .all()
    .reduce((s, c) => s - ctx.libro.saldo(c.id), 0);
}

export function listarCuentas(ctx: Contexto): VistaCuentas {
  materializarOcurrencias(ctx);
  const hoy = ctx.reloj.hoy();
  const tienes: CuentaTienes[] = cuentasPropias(ctx)
    .filter((c) => c.subtipo !== 'tarjeta_credito')
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      subtipo: c.subtipo as CuentaTienes['subtipo'],
      ultimos4: c.ultimos4,
      saldo: ctx.libro.saldo(c.id),
      contadaEl: c.subtipo === 'efectivo' ? fechaUltimoArqueo(ctx, c.id) : null,
    }));
  const personas = listarPersonas(ctx);
  const debes: CuentaDebes[] = [
    ...tarjetasActivas(ctx).map((t) => ({
      id: t.cuentaId,
      tipo: 'tarjeta' as const,
      nombre: t.nombre,
      ultimos4: t.ultimos4,
      saldo: t.saldoRevolvente,
      meses: mesesDe(ctx, t.cuentaId),
      limiteCredito: t.limiteCredito,
      apartar: null,
    })),
    ...personas
      .filter((p) => p.saldo < 0)
      .map((p) => ({
        id: p.cuentaId,
        tipo: 'persona' as const,
        nombre: p.nombre,
        ultimos4: null,
        saldo: -p.saldo,
        meses: 0,
        limiteCredito: null,
        apartar: p.apartar,
      })),
  ];
  const teDeben = personas
    .filter((p) => p.saldo > 0)
    .map((p) => ({ id: p.cuentaId, nombre: p.nombre, saldo: p.saldo }));
  const limite = sumarDias(hoy, 30);
  const compromisos = listarOcurrencias(ctx, { estado: 'pendiente', tipo: 'egreso' })
    .filter((o) => o.fecha < limite)
    .map((o) => ({ programadoId: o.programadoId, concepto: o.concepto, fecha: o.fecha, monto: o.monto }));
  const ingresos = listarOcurrencias(ctx, { estado: 'pendiente', tipo: 'ingreso' }).filter(
    (o) => o.fecha >= hoy && o.fecha < limite && o.monto > 0,
  );
  const loQueViene: ProximoMovimiento[] = [
    ...compromisos.map((c) => ({ ...c, tipo: 'egreso' as const })),
    ...ingresos.map((o) => ({
      programadoId: o.programadoId,
      concepto: o.concepto,
      fecha: o.fecha,
      monto: o.monto,
      tipo: 'ingreso' as const,
    })),
  ].sort((a, b) =>
    a.fecha === b.fecha
      ? a.tipo === b.tipo
        ? 0
        : a.tipo === 'ingreso'
          ? -1
          : 1
      : a.fecha < b.fecha
        ? -1
        : 1,
  );
  return { tienes, debes, teDeben, compromisos, loQueViene };
}

/** Categorías del espacio personal para el formulario (sin las de sistema). */
export function listarCategorias(
  ctx: Contexto,
  naturaleza: 'gasto' | 'ingreso',
): { slug: string; nombre: string; tipoGasto: 'variable' | 'fijo' | null }[] {
  return ctx.db
    .select()
    .from(cuenta)
    .where(and(eq(cuenta.naturaleza, naturaleza), eq(cuenta.espacio, 'personal'), eq(cuenta.sistema, 0)))
    .orderBy(asc(cuenta.nombre))
    .all()
    .flatMap((c) =>
      c.categoriaSlug ? [{ slug: c.categoriaSlug, nombre: c.nombre, tipoGasto: c.tipoGasto }] : [],
    );
}

/**
 * «Tienes $5,224 y debes $1,850.» (dirección B, tablero B5): la suma de Tienes y de Debes como se ven en Cuentas. En
 * lo que debes cuentan también los meses sin intereses que faltan; un saldo a favor no resta (regla 12: ante la
 * duda, contar de más lo que se debe).
 */
export function totalesCuentas(v: Pick<VistaCuentas, 'tienes' | 'debes'>): {
  readonly tienes: Centavos;
  readonly debes: Centavos;
} {
  const tienes = v.tienes.reduce((s, c) => s + c.saldo, 0);
  const debes = v.debes.reduce((s, d) => s + Math.max(0, d.saldo) + (d.tipo === 'tarjeta' ? d.meses : 0), 0);
  return { tienes: tienes as Centavos, debes: debes as Centavos };
}
