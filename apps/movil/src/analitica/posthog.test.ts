import { describe, expect, it, vi } from 'vitest';
import { MENSAJE_TECNICO_ENVIO_HTTP } from './mensajes';
import { leerConfigPosthog, transportePosthog } from './posthog';

describe('PostHog (adaptador)', () => {
  it('sin llave en la build no hay analítica: no existe ningún valor por omisión', () => {
    expect(leerConfigPosthog(undefined, undefined)).toBeNull();
    expect(leerConfigPosthog({}, undefined)).toBeNull();
    expect(leerConfigPosthog({ posthogKey: '  ' }, undefined)).toBeNull();
    expect(
      leerConfigPosthog({ posthogKey: 'phc_x', posthogHost: 'http://inseguro.test' }, undefined),
    ).toBeNull();
    expect(leerConfigPosthog({ posthogKey: 'phc_x' }, undefined)).toEqual({
      llave: 'phc_x',
      host: 'https://us.i.posthog.com',
    });
    expect(leerConfigPosthog(undefined, 'phc_entorno')).toEqual({
      llave: 'phc_entorno',
      host: 'https://us.i.posthog.com',
    });
    expect(
      leerConfigPosthog({ posthogKey: 'phc_x', posthogHost: 'https://eu.i.posthog.com/' }, undefined),
    ).toEqual({ llave: 'phc_x', host: 'https://eu.i.posthog.com' });
  });

  it('envía por https a /capture/ sin perfiles de persona ni geolocalización', async () => {
    const fetchFalso = vi.fn(async () => new Response('{}', { status: 200 }));
    const enviar = transportePosthog({ llave: 'phc_x', host: 'https://us.i.posthog.com' }, fetchFalso);
    await enviar({
      evento: 'arqueo',
      idAnonimo: '6f1c2a3b-0d4e-4f50-8a6b-7c8d9e0f1a2b',
      instante: '2026-10-11T16:00:00.000Z',
      propiedades: { resultado: 'exacto', $process_person_profile: false, $geoip_disable: true },
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/capture/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      api_key: 'phc_x',
      event: 'arqueo',
      distinct_id: '6f1c2a3b-0d4e-4f50-8a6b-7c8d9e0f1a2b',
      timestamp: '2026-10-11T16:00:00.000Z',
      properties: { resultado: 'exacto', $process_person_profile: false, $geoip_disable: true },
    });
  });

  it('una respuesta de error se reporta como fallo sin incluir el cuerpo', async () => {
    const enviar = transportePosthog(
      { llave: 'phc_x', host: 'https://us.i.posthog.com' },
      async () => new Response('nope con $1,099.90 en OXXO', { status: 500 }),
    );
    await expect(
      enviar({ evento: 'app_abierta', idAnonimo: 'x', instante: 'y', propiedades: {} }),
    ).rejects.toMatchObject({ codigo: 'analitica_http_500', message: MENSAJE_TECNICO_ENVIO_HTTP });
  });
});
