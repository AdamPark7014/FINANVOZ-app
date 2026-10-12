// CA-M7-01 · `POST /webhooks/revenuecat`: autorización con el secreto, contrato y registros sin datos.
import { describe, expect, it, vi } from 'vitest';
import type { EventoRegistro } from '../nlu/registro.ts';
import { lineaRegistro } from '../nlu/registro.ts';
import type { AccionDerecho } from './evento.ts';
import { crearManejadorRevenueCat, type DependenciasRevenueCat } from './manejador.ts';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres-0123456789';
const U1 = '00000000-0000-4000-8000-000000000001';

const evento = {
  api_version: '1.0',
  event: {
    id: 'evt-1',
    type: 'INITIAL_PURCHASE',
    app_user_id: U1,
    aliases: [U1],
    entitlement_ids: ['plus'],
    period_type: 'TRIAL',
    expiration_at_ms: 1_800_000_000_000,
    event_timestamp_ms: 1_790_000_000_000,
    price: 98765,
    product_id: 'plusmarcador',
  },
};

function solicitud(cuerpo: unknown, autorizacion: string | null = `Bearer ${SECRETO}`, metodo = 'POST') {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (autorizacion !== null) h.authorization = autorizacion;
  return new Request('https://proxy.prueba/functions/v1/webhooks-revenuecat', {
    method: metodo,
    headers: h,
    ...(metodo === 'POST' ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}),
  });
}

function armar(o: Partial<DependenciasRevenueCat> = {}) {
  const registros: EventoRegistro[] = [];
  const aplicar = vi.fn<(a: Exclude<AccionDerecho, { tipo: 'ignorar' }>) => Promise<string>>(
    async () => 'aplicado',
  );
  const manejar = crearManejadorRevenueCat({
    secreto: SECRETO,
    aplicar,
    registrar: (e) => registros.push(e),
    ...o,
  });
  return { manejar, aplicar, registros };
}

describe('webhook de RevenueCat', () => {
  it('con el secreto aplica el derecho y responde 200', async () => {
    const { manejar, aplicar, registros } = armar();
    const r = await manejar(solicitud(evento));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(aplicar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'derecho', plan: 'plus', usuarios: [U1] }),
    );
    expect(registros).toEqual([
      {
        usuario_hash: null,
        endpoint: '/webhooks/revenuecat',
        codigo: 'INITIAL_PURCHASE:aplicado',
        estado_http: 200,
      },
    ]);
  });

  it('sin secreto, con otro secreto o sin "Bearer": 401 y no toca derechos', async () => {
    const { manejar, aplicar } = armar();
    for (const a of [null, 'Bearer otro', SECRETO, `Bearer ${SECRETO}x`, `Basic ${SECRETO}`]) {
      const r = await manejar(solicitud(evento, a));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'no_autorizado' });
    }
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('sin el secreto configurado (o demasiado corto) responde 503', async () => {
    for (const secreto of [undefined, 'corto']) {
      const { manejar } = armar({ secreto });
      expect((await manejar(solicitud(evento))).status).toBe(503);
    }
  });

  it('otro método: 405; cuerpo inválido o enorme: 400', async () => {
    const { manejar } = armar();
    expect((await manejar(solicitud(null, `Bearer ${SECRETO}`, 'GET'))).status).toBe(405);
    expect((await manejar(solicitud('{no es json'))).status).toBe(400);
    expect((await manejar(solicitud({ event: { type: 'RENEWAL' } }))).status).toBe(400);
    expect((await manejar(solicitud('x'.repeat(70_000)))).status).toBe(400);
  });

  it('eventos que no cambian derechos responden 200 sin tocar la base', async () => {
    const { manejar, aplicar } = armar();
    const r = await manejar(solicitud({ event: { ...evento.event, type: 'TEST' } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultado: 'ignorado' });
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('si la base falla responde 500 para que RevenueCat reintente', async () => {
    const { manejar } = armar({
      aplicar: async () => {
        throw new Error(`fallo con ${U1}`);
      },
    });
    const r = await manejar(solicitud(evento));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'error_interno' });
  });

  it('los registros nunca llevan usuario, precio, producto ni el secreto', async () => {
    const lineas: string[] = [];
    const { manejar } = armar({ registrar: (e) => lineas.push(lineaRegistro(e)) });
    await manejar(solicitud(evento));
    await manejar(solicitud(evento, 'Bearer otro'));
    const todo = lineas.join('\n');
    for (const prohibido of [U1, '98765', 'plusmarcador', SECRETO, 'Bearer'])
      expect(todo).not.toContain(prohibido);
  });
});
