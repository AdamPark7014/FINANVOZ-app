// Eventos del webhook de RevenueCat (CA-M7-01) → cambios de `derechos`. Solo se leen los campos que deciden el
// plan; precio, moneda, producto y tienda se ignoran y nunca se registran (regla 9).
import { z } from 'zod';

/** Identificador del derecho de Plus en RevenueCat (Entitlements → `plus`). */
export const ENTITLEMENT_PLUS = 'plus';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Id = z.string().max(200);
const Ms = z.number().int().nonnegative();

const Evento = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(60),
  event_timestamp_ms: Ms,
  app_user_id: Id.nullish(),
  original_app_user_id: Id.nullish(),
  aliases: z.array(Id).max(100).nullish(),
  transferred_from: z.array(Id).max(100).nullish(),
  transferred_to: z.array(Id).max(100).nullish(),
  entitlement_ids: z.array(z.string().max(100)).max(50).nullish(),
  entitlement_id: z.string().max(100).nullish(),
  period_type: z.string().max(30).nullish(),
  expiration_at_ms: Ms.nullish(),
});

const Cuerpo = z.object({ event: Evento });

/** Eventos que dejan Plus vigente hasta `expiration_at_ms` (la cancelación también: se quita al vencer). */
const MANTIENEN_PLUS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'CANCELLATION',
  'BILLING_ISSUE',
]);

export type AccionDerecho =
  | {
      tipo: 'derecho';
      eventoId: string;
      tipoEvento: string;
      usuarios: string[];
      plan: 'gratis' | 'plus';
      /** ISO 8601; `null` = sin vencimiento. */
      vigenteHasta: string | null;
      enPrueba: boolean;
      eventoMs: number;
    }
  | { tipo: 'transferir'; eventoId: string; tipoEvento: string; de: string[]; a: string[]; eventoMs: number }
  | { tipo: 'ignorar'; tipoEvento: string; motivo: 'tipo' | 'otro_derecho' | 'sin_usuario' };

/** Ids que son usuarios de Supabase (uuid), sin repetir y en minúsculas. Los anónimos de RevenueCat no sirven. */
function usuarios(...listas: (readonly (string | null | undefined)[] | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  for (const lista of listas)
    for (const id of lista ?? []) if (id && UUID.test(id)) vistos.add(id.toLowerCase());
  return [...vistos];
}

/** `null` si el cuerpo no tiene la forma de un evento de RevenueCat. */
export function traducirEvento(cuerpo: unknown): AccionDerecho | null {
  const r = Cuerpo.safeParse(cuerpo);
  if (!r.success) return null;
  const e = r.data.event;
  const tipoEvento = e.type;

  if (tipoEvento === 'TRANSFER') {
    const a = usuarios(e.transferred_to);
    if (a.length === 0) return { tipo: 'ignorar', tipoEvento, motivo: 'sin_usuario' };
    return {
      tipo: 'transferir',
      eventoId: e.id,
      tipoEvento,
      de: usuarios(e.transferred_from),
      a,
      eventoMs: e.event_timestamp_ms,
    };
  }

  const vence = tipoEvento === 'EXPIRATION';
  if (!vence && !MANTIENEN_PLUS.has(tipoEvento)) return { tipo: 'ignorar', tipoEvento, motivo: 'tipo' };
  const derechos = e.entitlement_ids ?? (e.entitlement_id ? [e.entitlement_id] : []);
  if (!derechos.includes(ENTITLEMENT_PLUS)) return { tipo: 'ignorar', tipoEvento, motivo: 'otro_derecho' };
  const ids = usuarios([e.app_user_id, e.original_app_user_id], e.aliases);
  if (ids.length === 0) return { tipo: 'ignorar', tipoEvento, motivo: 'sin_usuario' };

  const expira = e.expiration_at_ms ?? null;
  return {
    tipo: 'derecho',
    eventoId: e.id,
    tipoEvento,
    usuarios: ids,
    plan: vence ? 'gratis' : 'plus',
    vigenteHasta: vence || expira === null ? null : new Date(expira).toISOString(),
    enPrueba: !vence && e.period_type === 'TRIAL',
    eventoMs: e.event_timestamp_ms,
  };
}
