import { and, eq, ne } from 'drizzle-orm';
import { normalizarComercio } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { normalizarAlias } from '@cartera/nlu';
import { cuentaPorId } from './catalogo';
import type { Contexto } from './contexto';

const { aliasCuenta, reglaComercio, cuenta } = esquema;

/**
 * Aprendizaje local (`06 §12`, RF-REG-08): nada de esto sale del teléfono.
 * Una corrección de cuenta agrega el alias dicho a `alias_cuenta` de la cuenta elegida.
 */
export function aprenderAlias(ctx: Contexto, alias: string | null | undefined, cuentaId: string): void {
  const a = normalizarAlias(alias ?? '');
  if (a === '') return;
  const c = cuentaPorId(ctx, cuentaId);
  if (c.sistema === 1) return; // las cuentas puente no aprenden alias
  ctx.db.insert(aliasCuenta).values({ cuentaId, aliasNormalizado: a }).onConflictDoNothing().run();
}

/** Llave de `regla_comercio` para un comercio o, si no hay, una descripción (E9.1). */
export function llaveComercio(comercio: string | null | undefined, descripcion: string | null | undefined) {
  return normalizarComercio(comercio) || normalizarComercio(descripcion);
}

/** Una corrección de categoría crea o actualiza `regla_comercio` (`fuente = 'aprendida'`). */
export function aprenderCategoria(
  ctx: Contexto,
  comercio: string | null | undefined,
  descripcion: string | null | undefined,
  categoriaCuentaId: string,
): void {
  const llave = llaveComercio(comercio, descripcion);
  if (llave === '') return;
  const previa = ctx.db
    .select()
    .from(reglaComercio)
    .where(eq(reglaComercio.comercioNormalizado, llave))
    .get();
  const ahora = ctx.reloj.ahora();
  if (previa) {
    ctx.db
      .update(reglaComercio)
      .set({ categoriaCuentaId, fuente: 'aprendida', usos: previa.usos + 1, actualizadaEn: ahora })
      .where(eq(reglaComercio.comercioNormalizado, llave))
      .run();
  } else {
    ctx.db
      .insert(reglaComercio)
      .values({
        comercioNormalizado: llave,
        categoriaCuentaId,
        fuente: 'aprendida',
        usos: 1,
        actualizadaEn: ahora,
      })
      .run();
  }
}

/** Slug de la categoría que la persona ya le enseñó a la app (o fijó) para ese comercio o descripción. */
export function categoriaAprendida(
  ctx: Contexto,
  comercio: string | null | undefined,
  descripcion: string | null | undefined,
  naturaleza: 'gasto' | 'ingreso',
): string | null {
  const llave = llaveComercio(comercio, descripcion);
  if (llave === '') return null;
  const fila = ctx.db
    .select({ slug: cuenta.categoriaSlug })
    .from(reglaComercio)
    .innerJoin(cuenta, eq(cuenta.id, reglaComercio.categoriaCuentaId))
    .where(
      and(
        eq(reglaComercio.comercioNormalizado, llave),
        ne(reglaComercio.fuente, 'semilla'),
        eq(cuenta.naturaleza, naturaleza),
      ),
    )
    .get();
  return fila?.slug ?? null;
}
