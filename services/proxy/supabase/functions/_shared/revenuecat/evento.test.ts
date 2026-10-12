// CA-M7-01 · traducción de eventos de RevenueCat a cambios de derechos.
import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_PLUS, traducirEvento } from './evento.ts';

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const EXPIRA = Date.UTC(2026, 9, 26, 12, 0, 0);
const AHORA = Date.UTC(2026, 9, 12, 12, 0, 0);

function cuerpo(evento: Record<string, unknown>) {
  return {
    api_version: '1.0',
    event: {
      id: 'evt-1',
      type: 'INITIAL_PURCHASE',
      app_user_id: U1,
      original_app_user_id: U1,
      aliases: [U1],
      entitlement_ids: [ENTITLEMENT_PLUS],
      period_type: 'TRIAL',
      expiration_at_ms: EXPIRA,
      event_timestamp_ms: AHORA,
      environment: 'SANDBOX',
      store: 'PLAY_STORE',
      price: 69,
      currency: 'MXN',
      product_id: 'plus_mensual',
      ...evento,
    },
  };
}

describe('traducirEvento', () => {
  it('la compra inicial en prueba activa Plus hasta el fin de la prueba', () => {
    expect(traducirEvento(cuerpo({}))).toEqual({
      tipo: 'derecho',
      eventoId: 'evt-1',
      tipoEvento: 'INITIAL_PURCHASE',
      usuarios: [U1],
      plan: 'plus',
      vigenteHasta: new Date(EXPIRA).toISOString(),
      enPrueba: true,
      eventoMs: AHORA,
    });
  });

  it('renovación, cambio de producto, reactivación, extensión y problema de cobro mantienen Plus con su vencimiento', () => {
    for (const type of [
      'RENEWAL',
      'PRODUCT_CHANGE',
      'UNCANCELLATION',
      'SUBSCRIPTION_EXTENDED',
      'TEMPORARY_ENTITLEMENT_GRANT',
      'NON_RENEWING_PURCHASE',
      'BILLING_ISSUE',
    ]) {
      const a = traducirEvento(cuerpo({ type, period_type: 'NORMAL' }));
      expect(a).toMatchObject({ tipo: 'derecho', plan: 'plus', enPrueba: false, tipoEvento: type });
    }
  });

  it('la cancelación deja Plus hasta que vence (no lo quita antes)', () => {
    expect(traducirEvento(cuerpo({ type: 'CANCELLATION', period_type: 'TRIAL' }))).toMatchObject({
      tipo: 'derecho',
      plan: 'plus',
      vigenteHasta: new Date(EXPIRA).toISOString(),
      enPrueba: true,
    });
  });

  it('el vencimiento (también de la prueba sin pagar) vuelve a Gratis', () => {
    expect(traducirEvento(cuerpo({ type: 'EXPIRATION' }))).toMatchObject({
      tipo: 'derecho',
      plan: 'gratis',
      vigenteHasta: null,
      enPrueba: false,
    });
  });

  it('solo usuarios de Supabase (uuid): los ids anónimos de RevenueCat se descartan', () => {
    const a = traducirEvento(
      cuerpo({
        app_user_id: '$RCAnonymousID:abc',
        original_app_user_id: U2,
        aliases: ['$RCAnonymousID:abc', U2, U2],
      }),
    );
    expect(a).toMatchObject({ tipo: 'derecho', usuarios: [U2] });
    expect(
      traducirEvento(cuerpo({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: 'x', aliases: [] })),
    ).toEqual({ tipo: 'ignorar', motivo: 'sin_usuario', tipoEvento: 'INITIAL_PURCHASE' });
  });

  it('un evento de otro derecho (Negocio, M11) no toca Plus; acepta el campo viejo entitlement_id', () => {
    expect(traducirEvento(cuerpo({ entitlement_ids: ['negocio'] }))).toMatchObject({
      tipo: 'ignorar',
      motivo: 'otro_derecho',
    });
    expect(traducirEvento(cuerpo({ entitlement_ids: null, entitlement_id: ENTITLEMENT_PLUS }))).toMatchObject(
      {
        tipo: 'derecho',
        plan: 'plus',
      },
    );
  });

  it('transferencia: de los usuarios de origen a los de destino', () => {
    expect(
      traducirEvento(
        cuerpo({
          type: 'TRANSFER',
          app_user_id: undefined,
          transferred_from: [U1, '$RCAnonymousID:x'],
          transferred_to: [U2],
          entitlement_ids: undefined,
        }),
      ),
    ).toEqual({
      tipo: 'transferir',
      eventoId: 'evt-1',
      tipoEvento: 'TRANSFER',
      de: [U1],
      a: [U2],
      eventoMs: AHORA,
    });
  });

  it('TEST y eventos informativos se ignoran', () => {
    for (const type of [
      'TEST',
      'SUBSCRIPTION_PAUSED',
      'SUBSCRIBER_ALIAS',
      'INVOICE_ISSUANCE',
      'ALGO_NUEVO',
    ]) {
      expect(traducirEvento(cuerpo({ type }))).toMatchObject({ tipo: 'ignorar', motivo: 'tipo' });
    }
  });

  it('Plus sin vencimiento (compra única) queda sin fecha', () => {
    expect(traducirEvento(cuerpo({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: null }))).toMatchObject({
      plan: 'plus',
      vigenteHasta: null,
    });
  });

  it('rechaza cuerpos fuera del contrato', () => {
    expect(traducirEvento(null)).toBeNull();
    expect(traducirEvento({ event: { type: 'RENEWAL' } })).toBeNull();
    expect(traducirEvento(cuerpo({ id: '' }))).toBeNull();
    expect(traducirEvento(cuerpo({ event_timestamp_ms: 'ayer' }))).toBeNull();
  });
});
