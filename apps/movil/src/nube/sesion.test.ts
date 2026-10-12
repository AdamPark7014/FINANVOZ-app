import { describe, expect, it } from 'vitest';
import type { PeticionTransporte, Transporte } from '@cartera/nlu';
import { almacenEnMemoria } from '../db/llave';
import { LLAVES_ALMACEN } from '../privacidad/borrar';
import { leerConfigNube } from './config';
import { CLAVE_SESION_NUBE, crearSesionNube } from './sesion';

const URL_PROYECTO = 'https://abc.supabase.co';

function auth(...respuestas: { status: number; cuerpo: unknown }[]) {
  const llamadas: { url: string; peticion: PeticionTransporte }[] = [];
  const transporte: Transporte = async (url, peticion) => {
    llamadas.push({ url, peticion });
    const r = respuestas.shift();
    if (!r) throw new TypeError('Network request failed');
    return { status: r.status, json: async () => r.cuerpo };
  };
  return { transporte, llamadas };
}

const token = (n: number) => ({ access_token: `jwt-${n}`, refresh_token: `rt-${n}`, expires_in: 3600 });

describe('sesión anónima de Supabase', () => {
  it('crea el usuario anónimo una sola vez y reutiliza el token mientras no venza', async () => {
    const almacen = almacenEnMemoria();
    let ahora = 1_000_000;
    const { transporte, llamadas } = auth({ status: 200, cuerpo: token(1) });
    const sesion = crearSesionNube({
      url: `${URL_PROYECTO}/`,
      llaveAnonima: 'anon',
      almacen,
      transporte,
      ahora: () => ahora,
    });
    const [a, b] = await Promise.all([sesion.obtenerToken(), sesion.obtenerToken()]);
    expect([a, b]).toEqual(['jwt-1', 'jwt-1']);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toBe(`${URL_PROYECTO}/auth/v1/signup`);
    expect(llamadas[0]?.peticion.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon' });
    expect(JSON.parse(almacen.obtener(CLAVE_SESION_NUBE) ?? '')).toEqual({
      access_token: 'jwt-1',
      refresh_token: 'rt-1',
      vence_en: 1_000_000 + 3_600_000,
    });
    ahora += 60_000;
    expect(await sesion.obtenerToken()).toBe('jwt-1');
    expect(llamadas).toHaveLength(1);
  });

  it('renueva con el refresh token al vencer o tras un 401; si ya no sirve, crea otro anónimo', async () => {
    const almacen = almacenEnMemoria();
    let ahora = 0;
    const { transporte, llamadas } = auth(
      { status: 200, cuerpo: token(1) },
      { status: 200, cuerpo: token(2) },
      { status: 400, cuerpo: { error: 'invalid_grant' } },
      { status: 200, cuerpo: token(3) },
    );
    const sesion = crearSesionNube({
      url: URL_PROYECTO,
      llaveAnonima: 'anon',
      almacen,
      transporte,
      ahora: () => ahora,
    });
    expect(await sesion.obtenerToken()).toBe('jwt-1');
    ahora = 3_600_000 - 30_000; // dentro del margen de un minuto
    expect(await sesion.obtenerToken()).toBe('jwt-2');
    expect(llamadas[1]?.url).toBe(`${URL_PROYECTO}/auth/v1/token?grant_type=refresh_token`);
    expect(JSON.parse(llamadas[1]?.peticion.body ?? '')).toEqual({ refresh_token: 'rt-1' });
    expect(await sesion.obtenerToken({ renovar: true })).toBe('jwt-3');
    expect(llamadas.map((l) => l.url.replace(URL_PROYECTO, ''))).toEqual([
      '/auth/v1/signup',
      '/auth/v1/token?grant_type=refresh_token',
      '/auth/v1/token?grant_type=refresh_token',
      '/auth/v1/signup',
    ]);
  });

  it('sin red rechaza (el cliente lo toma como sin_red); un error de Auth da null', async () => {
    const sinRed = crearSesionNube({
      url: URL_PROYECTO,
      llaveAnonima: 'anon',
      almacen: almacenEnMemoria(),
      transporte: auth().transporte,
    });
    await expect(sinRed.obtenerToken()).rejects.toThrow();
    const rechazada = crearSesionNube({
      url: URL_PROYECTO,
      llaveAnonima: 'anon',
      almacen: almacenEnMemoria(),
      transporte: auth({ status: 422, cuerpo: { msg: 'Anonymous sign-ins are disabled' } }).transporte,
    });
    expect(await rechazada.obtenerToken()).toBeNull();
  });

  it('"Borrar todo" elimina los tokens de la sesión', () => {
    expect(LLAVES_ALMACEN).toContain(CLAVE_SESION_NUBE);
  });
});

describe('configuración del nivel nube', () => {
  it('sin supabaseUrl o supabaseAnonKey el nivel nube queda apagado', () => {
    expect(leerConfigNube(undefined)).toBeNull();
    expect(leerConfigNube({})).toBeNull();
    expect(leerConfigNube({ supabaseUrl: URL_PROYECTO })).toBeNull();
    expect(leerConfigNube({ supabaseUrl: 'http://abc.supabase.co', supabaseAnonKey: 'x' })).toBeNull();
    expect(leerConfigNube({ supabaseUrl: ` ${URL_PROYECTO} `, supabaseAnonKey: 'anon' })).toEqual({
      url: URL_PROYECTO,
      llaveAnonima: 'anon',
    });
  });
});
