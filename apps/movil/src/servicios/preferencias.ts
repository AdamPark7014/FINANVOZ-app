import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import { esquema } from '@cartera/datos';
import type { Contexto } from './contexto';

const { ajuste } = esquema;

/**
 * Tabla `ajuste` (`04 §3`): un JSON por clave, validado con Zod al leer y al escribir. Aquí viven el colchón,
 * el bloqueo, el estado del onboarding, la evidencia del consentimiento, los avisos de una vez y las frases
 * "por interpretar" (una fila por frase, clave `por_interpretar:<id>`).
 */
export function leerAjuste<T>(ctx: Contexto, clave: string, forma: z.ZodType<T>): T | null {
  const fila = ctx.db.select().from(ajuste).where(eq(ajuste.clave, clave)).get();
  if (!fila) return null;
  const r = forma.safeParse(JSON.parse(fila.valor));
  if (!r.success) throw new ErrorDominio('ajuste_invalido', `el ajuste ${clave.split(':')[0]} no es válido`);
  return r.data;
}

export function escribirAjuste<T>(ctx: Contexto, clave: string, forma: z.ZodType<T>, valor: T): void {
  const r = forma.safeParse(valor);
  if (!r.success) throw new ErrorDominio('ajuste_invalido', `el ajuste ${clave.split(':')[0]} no es válido`);
  const fila = { clave, valor: JSON.stringify(r.data), actualizadoEn: ctx.reloj.ahora() };
  ctx.db
    .insert(ajuste)
    .values(fila)
    .onConflictDoUpdate({
      target: ajuste.clave,
      set: { valor: fila.valor, actualizadoEn: fila.actualizadoEn },
    })
    .run();
}

export function borrarAjuste(ctx: Contexto, clave: string): void {
  ctx.db.delete(ajuste).where(eq(ajuste.clave, clave)).run();
}

/** Ajustes cuya clave empieza con `prefijo`, en orden de clave. */
export function listarAjustes<T>(
  ctx: Contexto,
  prefijo: string,
  forma: z.ZodType<T>,
): { clave: string; valor: T }[] {
  const filas = ctx.db
    .select()
    .from(ajuste)
    .where(and(gte(ajuste.clave, prefijo), lt(ajuste.clave, `${prefijo}\uffff`)))
    .orderBy(asc(ajuste.clave))
    .all();
  return filas.map((f) => {
    const r = forma.safeParse(JSON.parse(f.valor));
    if (!r.success) throw new ErrorDominio('ajuste_invalido', `el ajuste ${prefijo} no es válido`);
    return { clave: f.clave, valor: r.data };
  });
}

/** Centavos ≥ 0 (enteros). */
export const CentavosNoNegativos = z.int().min(0);
