import { and, asc, eq, inArray } from 'drizzle-orm';
import { ErrorDominio, type Centavos } from '@cartera/core';
import { esquema, idCategoria } from '@cartera/datos';
import { normalizarAlias } from '@cartera/nlu';
import type { Contexto } from './contexto';

const { cuenta, aliasCuenta } = esquema;

/** Subtipos de cuentas propias que el usuario crea en M2. */
export const SUBTIPOS_PROPIOS = ['efectivo', 'debito', 'billetera', 'ahorro', 'tarjeta_credito'] as const;
export type SubtipoPropio = (typeof SUBTIPOS_PROPIOS)[number];

export interface CuentaPropia {
  readonly id: string;
  readonly nombre: string;
  readonly subtipo: SubtipoPropio;
  readonly liquida: boolean;
  readonly ultimos4: string | null;
  readonly institucion: string | null;
  readonly alias: readonly string[];
}

export type FilaCuenta = typeof cuenta.$inferSelect;

export function cuentaPorId(ctx: Contexto, id: string): FilaCuenta {
  const fila = ctx.db.select().from(cuenta).where(eq(cuenta.id, id)).get();
  if (!fila) throw new ErrorDominio('cuenta_inexistente', 'la cuenta no existe');
  return fila;
}

function aliasDe(ctx: Contexto, ids: readonly string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  if (ids.length === 0) return mapa;
  const filas = ctx.db
    .select()
    .from(aliasCuenta)
    .where(inArray(aliasCuenta.cuentaId, [...ids]))
    .orderBy(asc(aliasCuenta.aliasNormalizado))
    .all();
  for (const f of filas) mapa.set(f.cuentaId, [...(mapa.get(f.cuentaId) ?? []), f.aliasNormalizado]);
  return mapa;
}

/** Cuentas propias activas del espacio personal (tienes y tarjetas), en orden de creación. */
export function cuentasPropias(ctx: Contexto): CuentaPropia[] {
  const filas = ctx.db
    .select()
    .from(cuenta)
    .where(
      and(
        eq(cuenta.espacio, 'personal'),
        eq(cuenta.sistema, 0),
        eq(cuenta.archivada, 0),
        inArray(cuenta.subtipo, [...SUBTIPOS_PROPIOS]),
        inArray(cuenta.naturaleza, ['activo', 'pasivo']),
      ),
    )
    .orderBy(asc(cuenta.creadaEn), asc(cuenta.id))
    .all();
  const alias = aliasDe(
    ctx,
    filas.map((f) => f.id),
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    subtipo: f.subtipo as SubtipoPropio,
    liquida: f.liquida === 1,
    ultimos4: f.ultimos4,
    institucion: f.institucion,
    alias: alias.get(f.id) ?? [],
  }));
}

/** Alias normalizados (`06 §5`) sin repetidos ni vacíos. */
export function normalizarAliases(aliases: readonly string[]): string[] {
  return [...new Set(aliases.map((a) => normalizarAlias(a)).filter((a) => a !== ''))];
}

/** Inserta una cuenta (no financiero: el saldo se registra aparte con `saldo_inicial`) y sus alias. */
export function insertarCuenta(
  ctx: Contexto,
  datos: Omit<typeof cuenta.$inferInsert, 'id' | 'creadaEn'> & { alias?: readonly string[] },
): string {
  const id = ctx.generarId();
  const { alias = [], ...fila } = datos;
  ctx.db
    .insert(cuenta)
    .values({ ...fila, id, creadaEn: ctx.reloj.ahora() })
    .run();
  const normalizados = normalizarAliases(alias);
  if (normalizados.length > 0) {
    ctx.db
      .insert(aliasCuenta)
      .values(normalizados.map((a) => ({ cuentaId: id, aliasNormalizado: a })))
      .run();
  }
  return id;
}

/** Id de la categoría `slug` del espacio personal; falla si no existe o no es de esa naturaleza. */
export function idCategoriaDe(ctx: Contexto, slug: string, naturaleza: 'gasto' | 'ingreso'): string {
  const id = idCategoria(slug);
  const fila = ctx.db.select().from(cuenta).where(eq(cuenta.id, id)).get();
  if (!fila || fila.naturaleza !== naturaleza) {
    throw new ErrorDominio('categoria_desconocida', 'la categoría no existe');
  }
  return id;
}

/** Saldo con el signo del libro. */
export function saldo(ctx: Contexto, cuentaId: string): Centavos {
  return ctx.libro.saldo(cuentaId);
}

/** Saldo como lo ve la persona: lo que tiene (activo) o lo que debe (pasivo), positivo si es "normal". */
export function saldoVisible(ctx: Contexto, fila: Pick<FilaCuenta, 'id' | 'naturaleza'>): Centavos {
  const s = ctx.libro.saldo(fila.id);
  return fila.naturaleza === 'pasivo' ? -s : s;
}
