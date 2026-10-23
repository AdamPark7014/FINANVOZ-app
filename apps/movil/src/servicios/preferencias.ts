import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
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

const AjustesConfirmarPorVoz = z.strictObject({ activa: z.boolean() });
export type AjustesConfirmarPorVoz = z.infer<typeof AjustesConfirmarPorVoz>;

/**
 * Ajustes › Voz «Confirmar por voz» (Ola 7 §4): tras un registro dictado que pide confirmación («Entendí… ¿lo
 * registro?»), el micrófono escucha un turno de hasta 6 s para «sí», «no» o un cambio («fue con la Nu»). Encendido
 * por omisión. Cambiarlo pide el consentimiento, como «Contestarte en voz» (CA-M2-05).
 */
export function obtenerConfirmarPorVoz(ctx: Contexto): AjustesConfirmarPorVoz {
  return leerAjuste(ctx, 'confirmar_por_voz', AjustesConfirmarPorVoz) ?? { activa: true };
}

export function fijarConfirmarPorVoz(ctx: Contexto, activa: boolean): void {
  // `privacidad/consentimiento` también importa este archivo; solo se usan funciones al llamarlas, no al cargar.
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, 'confirmar_por_voz', AjustesConfirmarPorVoz, { activa });
}

/** Velocidades de la respuesta hablada (Ajustes › Voz, tres chips). */
export const VELOCIDADES_VOZ = ['pausada', 'normal', 'rapida'] as const;
export type VelocidadVoz = (typeof VELOCIDADES_VOZ)[number];

/** Cada campo tiene su valor por omisión: una versión nueva que agregue uno no invalida lo guardado. */
const AjustesVoz = z.strictObject({
  /** Voz elegida en Ajustes › Voz (`voz/voces`: identificador; en Android sin `-network`/`-local`). `null`: la mejor. */
  voz: z.string().min(1).max(200).nullable().default(null),
  velocidad: z.enum(VELOCIDADES_VOZ).default('normal'),
  /** iPhone: contestar aunque el interruptor de silencio esté puesto (apagado por omisión). */
  enSilencio: z.boolean().default(false),
  /** Ya se mostró una vez cómo descargar «Paulina (mejorada)». */
  guiaMejoradaVista: z.boolean().default(false),
});
export type AjustesVoz = z.output<typeof AjustesVoz>;

export const AJUSTES_VOZ_INICIALES: AjustesVoz = {
  voz: null,
  velocidad: 'normal',
  enSilencio: false,
  guiaMejoradaVista: false,
};

/** Cómo suena la respuesta hablada (Ajustes › Voz). Sin nada guardado: la mejor voz, velocidad normal. */
export function obtenerAjustesVoz(ctx: Contexto): AjustesVoz {
  return leerAjuste(ctx, 'voz_ajustes', AjustesVoz) ?? AJUSTES_VOZ_INICIALES;
}

/** Cambia solo lo que se pasa; pide el consentimiento, como los demás ajustes de voz (CA-M2-05). */
export function fijarAjustesVoz(ctx: Contexto, cambios: Partial<AjustesVoz>): AjustesVoz {
  exigirConsentimiento(ctx);
  const nuevos = { ...obtenerAjustesVoz(ctx), ...cambios };
  escribirAjuste(ctx, 'voz_ajustes', AjustesVoz, nuevos);
  return nuevos;
}
