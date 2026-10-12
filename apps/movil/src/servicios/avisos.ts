import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste, listarAjustes } from './preferencias';

/** Avisos que Hoy muestra una sola vez (`02 §3.1`, paso 4: "No sé"). */
const AvisoGuardado = z.strictObject({
  tipo: z.literal('msi_doble'),
  tarjeta_id: z.string(),
  tarjeta: z.string(),
  visto: z.boolean(),
});
type AvisoGuardado = z.infer<typeof AvisoGuardado>;

const PREFIJO = 'aviso:';

export interface Aviso {
  readonly id: string;
  readonly tipo: 'msi_doble';
  readonly texto: string;
}

export function crearAvisoMsiDoble(ctx: Contexto, tarjetaId: string, nombreTarjeta: string): void {
  escribirAjuste(ctx, `${PREFIJO}msi_doble:${tarjetaId}`, AvisoGuardado, {
    tipo: 'msi_doble',
    tarjeta_id: tarjetaId,
    tarjeta: nombreTarjeta,
    visto: false,
  });
}

function texto(a: AvisoGuardado): string {
  return `Puede que esté contando dos veces tus meses de la ${a.tarjeta}. Compáralo con tu próximo estado de cuenta.`;
}

/** Avisos aún no vistos. */
export function avisosPendientes(ctx: Contexto): Aviso[] {
  return listarAjustes(ctx, PREFIJO, AvisoGuardado)
    .filter((a) => !a.valor.visto)
    .map((a) => ({ id: a.clave, tipo: a.valor.tipo, texto: texto(a.valor) }));
}

/** La UI lo llama al mostrar el aviso: ya no vuelve a salir. */
export function marcarAvisoVisto(ctx: Contexto, id: string): void {
  const a = leerAjuste(ctx, id, AvisoGuardado);
  if (!a || !id.startsWith(PREFIJO)) throw new ErrorDominio('aviso_inexistente', 'el aviso no existe');
  escribirAjuste(ctx, id, AvisoGuardado, { ...a, visto: true });
}
