import { z } from 'zod';
import { esFecha } from '@cartera/core';

/**
 * Eventos de un grupo compartido (`docs/05-MOTORES.md §E17`): `{id, grupo_id, autor, creado_en, tipo, cuerpo}`,
 * inmutables e idempotentes por `id`. `autor` es `'a'` (quien creó el grupo) o `'b'` (quien se unió). Nunca
 * viajan en claro: el servidor solo ve `grupo_id`, `id` y `autor` (`cifrado.ts`).
 */

export type Autor = 'a' | 'b';
export const Autor = z.enum(['a', 'b']);

/** UUID en minúsculas (el `grupo_id` lo pone el servidor). */
export const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
/** UUIDv4 (aleatorio): un UUIDv7 dejaría en claro el instante de creación (E17). */
export const Uuid4 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

const Fecha = z.string().refine(esFecha, 'fecha inválida');
const Centavos = z.int().min(1).max(Number.MAX_SAFE_INTEGER);
/** Máximo de caracteres de la descripción de un gasto compartido. */
export const MAX_DESCRIPCION = 120;

export const CuerpoGasto = z.strictObject({
  fecha: Fecha,
  total: Centavos,
  pago: Autor,
  proporcion_a_bp: z.int().min(0).max(10000),
  descripcion: z.string().max(MAX_DESCRIPCION),
  /** `categoria_slug` de gasto (`04 §2.3`); cada teléfono la resuelve contra su catálogo. */
  categoria: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
});
export type CuerpoGasto = z.infer<typeof CuerpoGasto>;

export const CuerpoPago = z.strictObject({ fecha: Fecha, de: Autor, monto: Centavos });
export type CuerpoPago = z.infer<typeof CuerpoPago>;

export const CuerpoAnulado = z.strictObject({ id_anulado: Uuid4 });
export type CuerpoAnulado = z.infer<typeof CuerpoAnulado>;

const Comunes = { id: Uuid4, grupo_id: Uuid, autor: Autor, creado_en: z.int().min(0) };

export const EventoCompartido = z.discriminatedUnion('tipo', [
  z.strictObject({ ...Comunes, tipo: z.literal('gasto_compartido_creado'), cuerpo: CuerpoGasto }),
  z.strictObject({ ...Comunes, tipo: z.literal('pago_compartido_creado'), cuerpo: CuerpoPago }),
  z.strictObject({ ...Comunes, tipo: z.literal('evento_anulado'), cuerpo: CuerpoAnulado }),
]);
export type EventoCompartido = z.infer<typeof EventoCompartido>;
export type TipoEvento = EventoCompartido['tipo'];

/** Lo que va cifrado en el blob: todo menos los campos en claro (`grupo_id`, `id`, `autor`). */
export const ContenidoEvento = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('gasto_compartido_creado'),
    creado_en: z.int().min(0),
    cuerpo: CuerpoGasto,
  }),
  z.strictObject({
    tipo: z.literal('pago_compartido_creado'),
    creado_en: z.int().min(0),
    cuerpo: CuerpoPago,
  }),
  z.strictObject({ tipo: z.literal('evento_anulado'), creado_en: z.int().min(0), cuerpo: CuerpoAnulado }),
]);

/**
 * JSON del contenido con las llaves siempre en el mismo orden (el de `05 §E17`): dos teléfonos serializan igual el
 * mismo evento y la fusión puede comparar eventos por su texto.
 */
export function serializarContenido(e: EventoCompartido): string {
  let cuerpo: Record<string, unknown>;
  switch (e.tipo) {
    case 'gasto_compartido_creado': {
      const c = e.cuerpo;
      cuerpo = {
        fecha: c.fecha,
        total: c.total,
        pago: c.pago,
        proporcion_a_bp: c.proporcion_a_bp,
        descripcion: c.descripcion,
        categoria: c.categoria,
      };
      break;
    }
    case 'pago_compartido_creado':
      cuerpo = { fecha: e.cuerpo.fecha, de: e.cuerpo.de, monto: e.cuerpo.monto };
      break;
    case 'evento_anulado':
      cuerpo = { id_anulado: e.cuerpo.id_anulado };
      break;
  }
  return JSON.stringify({ tipo: e.tipo, creado_en: e.creado_en, cuerpo });
}

/** Forma canónica completa (campos en claro + contenido), para comparar dos copias de un mismo `id`. */
export function formaCanonica(e: EventoCompartido): string {
  return `${e.grupo_id}|${e.id}|${e.autor}|${serializarContenido(e)}`;
}

/** UUIDv4 (RFC 9562) con bytes aleatorios inyectados. */
export function uuid4(aleatorio: (n: number) => Uint8Array): string {
  const b = aleatorio(16);
  if (b.length !== 16) throw new Error('aleatorio devolvió otro tamaño');
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  let hex = '';
  for (const x of b) hex += x.toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** El otro lugar del grupo. */
export const otroAutor = (autor: Autor): Autor => (autor === 'a' ? 'b' : 'a');
