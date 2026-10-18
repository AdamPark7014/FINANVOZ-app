import { describe, expect, it, vi } from 'vitest';
import { abrirPrueba } from '../servicios/__pruebas__/base';
import { aceptarConsentimiento } from './consentimiento';
import {
  crearPuertoEvidencia,
  evidenciaPendiente,
  sincronizarEvidencia,
  type PuertoEvidencia,
} from './evidencia-servidor';

describe('evidencia del consentimiento en el servidor (08 §2, §7.1)', () => {
  it('sin consentimiento no envía nada', async () => {
    const p = abrirPrueba();
    const enviar = vi.fn<PuertoEvidencia['enviar']>(async () => true);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
    p.base.cerrar();
  });

  it('envía solo la versión y la hora de aceptación, una vez; si falla lo reintenta después', async () => {
    const p = abrirPrueba();
    const evidencia = aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    expect(evidenciaPendiente(p.ctx)).toBe(true);
    const enviar = vi.fn<PuertoEvidencia['enviar']>(async () => false);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(false);
    expect(evidenciaPendiente(p.ctx)).toBe(true);

    enviar.mockImplementation(async () => true);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(true);
    expect(enviar).toHaveBeenLastCalledWith({
      version_aviso: evidencia.version,
      aceptado_en: new Date(evidencia.aceptado_en).toISOString(),
    });
    expect(evidenciaPendiente(p.ctx)).toBe(false);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(true);
    expect(enviar).toHaveBeenCalledTimes(2);

    // Un error del puerto no rompe nada.
    const p2 = abrirPrueba();
    aceptarConsentimiento(p2.ctx, { datosFinancieros: true });
    expect(await sincronizarEvidencia(p2.ctx, { enviar: () => Promise.reject(new Error('red')) })).toBe(
      false,
    );
    p.base.cerrar();
    p2.base.cerrar();
  });

  it('al aceptar una versión nueva del aviso vuelve a quedar pendiente de enviar', async () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, version: '2026-10-m2' });
    const enviar = vi.fn<PuertoEvidencia['enviar']>(async () => true);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(true);
    expect(evidenciaPendiente(p.ctx)).toBe(false);

    aceptarConsentimiento(p.ctx, { datosFinancieros: true, medio: 'reconsentimiento' });
    expect(evidenciaPendiente(p.ctx)).toBe(true);
    expect(await sincronizarEvidencia(p.ctx, { enviar })).toBe(true);
    expect(enviar).toHaveBeenLastCalledWith(
      expect.objectContaining({ version_aviso: '2026-10-m7' }),
    );
    p.base.cerrar();
  });

  it('el puerto inserta en /rest/v1/consentimiento con la sesión anónima; 201 y 409 cuentan como enviada', async () => {
    const llamadas: [string, RequestInit][] = [];
    const respuestas = [401, 201, 409, 500];
    const transporte = vi.fn(async (url: string, init: RequestInit) => {
      llamadas.push([url, init]);
      return new Response(null, { status: respuestas.shift() ?? 500 });
    });
    const obtenerToken = vi.fn(async (o?: { renovar?: boolean }) => (o?.renovar ? 'jwt-nuevo' : 'jwt-viejo'));
    const puerto = crearPuertoEvidencia({
      url: 'https://abc.supabase.co/',
      llaveAnonima: 'anon',
      sesion: { obtenerToken },
      transporte,
    });
    const cuerpo = { version_aviso: '2026-10-m7', aceptado_en: '2026-10-11T16:00:00.000Z' };
    expect(await puerto.enviar(cuerpo)).toBe(true);
    expect(llamadas).toHaveLength(2);
    const [url, init] = llamadas[1] as [string, RequestInit];
    expect(url).toBe('https://abc.supabase.co/rest/v1/consentimiento');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeDefined();
    expect(init.headers).toEqual({
      apikey: 'anon',
      Authorization: 'Bearer jwt-nuevo',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    });
    expect(JSON.parse(init.body as string)).toEqual(cuerpo);
    expect(await puerto.enviar(cuerpo)).toBe(true);
    expect(await puerto.enviar(cuerpo)).toBe(false);

    const sinToken = crearPuertoEvidencia({
      url: 'https://abc.supabase.co',
      llaveAnonima: 'anon',
      sesion: { obtenerToken: async () => null },
      transporte,
    });
    expect(await sinToken.enviar(cuerpo)).toBe(false);
  });
});
