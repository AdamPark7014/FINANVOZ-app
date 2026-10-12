import { describe, expect, it } from 'vitest';
import type { Transporte } from '@cartera/nlu';
import { almacenEnMemoria } from '../db/llave';
import { crearCuentaRespaldo, normalizarCorreo } from './cuenta-respaldo';
import type { FetchNube, PeticionNube } from './http';
import { CLAVE_SESION_NUBE, crearSesionNube } from './sesion';
import { claimsDeToken } from './token';

const URL_PROYECTO = 'https://abc.supabase.co';
const ANONIMO = '00000000-0000-4000-8000-0000000000a1';
const ORIGINAL = '00000000-0000-4000-8000-0000000000b2';

const b64 = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** JWT con la forma de Supabase (la firma no se verifica en el teléfono). */
const jwt = (sub: string, extra: Record<string, unknown> = {}) =>
  `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', ...extra })}.firma`;
const JWT_ANONIMO = jwt(ANONIMO, { is_anonymous: true });
const sesionAuth = (token: string) => ({
  access_token: token,
  refresh_token: `rt-${token.length}`,
  expires_in: 3600,
});

/** Auth falso: responde en orden y registra cada petición. */
function authFalso(...respuestas: ({ status: number; cuerpo: unknown } | 'sin_red')[]) {
  const llamadas: { url: string; peticion: PeticionNube }[] = [];
  const fetch: FetchNube = async (url, peticion) => {
    llamadas.push({ url, peticion });
    const r = respuestas.shift();
    if (!r || r === 'sin_red') throw new TypeError('Network request failed');
    return {
      status: r.status,
      json: async () => r.cuerpo,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };
  const cuerpos = () => llamadas.map((l) => JSON.parse(String(l.peticion.body)) as Record<string, unknown>);
  return { fetch, llamadas, cuerpos };
}

/** Sesión anónima real (`sesion.ts`) cuyo signup devuelve `JWT_ANONIMO`. */
function preparar(...respuestas: Parameters<typeof authFalso>) {
  const almacen = almacenEnMemoria();
  const signups: string[] = [];
  const transporte: Transporte = async (url) => {
    signups.push(url);
    return { status: 200, json: async () => sesionAuth(signups.length === 1 ? JWT_ANONIMO : jwt('otro')) };
  };
  const sesion = crearSesionNube({ url: URL_PROYECTO, llaveAnonima: 'anon', almacen, transporte });
  const auth = authFalso(...respuestas);
  const cuenta = crearCuentaRespaldo({
    url: URL_PROYECTO,
    llaveAnonima: 'anon',
    almacen,
    sesion,
    fetch: auth.fetch,
  });
  return { almacen, sesion, cuenta, auth, signups };
}

describe('cuenta de respaldo: vincular el correo al usuario anónimo', () => {
  it('el mismo usuario_id queda con correo y la sesión de la app pasa a ser la de correo', async () => {
    const conCorreo = jwt(ANONIMO, { is_anonymous: false, email: 'ana@correo.mx' });
    const { cuenta, auth, sesion, almacen } = preparar(
      { status: 200, cuerpo: { id: ANONIMO } },
      { status: 200, cuerpo: sesionAuth(conCorreo) },
    );
    expect(await cuenta.estado()).toEqual({ usuarioId: ANONIMO, conCorreo: false, correo: null });

    expect(await cuenta.pedirCodigo('  Ana@Correo.MX ')).toEqual({ ok: true, modo: 'vincular' });
    expect(auth.llamadas[0]?.url).toBe(`${URL_PROYECTO}/auth/v1/user`);
    expect(auth.llamadas[0]?.peticion).toMatchObject({
      method: 'PUT',
      headers: { apikey: 'anon', Authorization: `Bearer ${JWT_ANONIMO}` },
    });
    expect(auth.cuerpos()[0]).toEqual({ email: 'ana@correo.mx' });

    expect(await cuenta.verificarCodigo('ana@correo.mx', '123 456', 'vincular')).toEqual({
      ok: true,
      usuarioId: ANONIMO,
      conCorreo: true,
      correo: 'ana@correo.mx',
    });
    expect(auth.llamadas[1]?.url).toBe(`${URL_PROYECTO}/auth/v1/verify`);
    expect(auth.llamadas[1]?.peticion.headers).toMatchObject({
      apikey: 'anon',
      Authorization: 'Bearer anon',
    });
    expect(auth.cuerpos()[1]).toEqual({ type: 'email_change', email: 'ana@correo.mx', token: '123456' });
    // El intérprete, RevenueCat y el respaldo usan ya la sesión de correo, sin pedir otra a Auth.
    expect(await sesion.obtenerToken()).toBe(conCorreo);
    expect(JSON.parse(almacen.obtener(CLAVE_SESION_NUBE) ?? '')).toMatchObject({ access_token: conCorreo });
  });

  it('teléfono nuevo: el correo ya tiene cuenta → entra con código al usuario original', async () => {
    const original = jwt(ORIGINAL, { is_anonymous: false, email: 'ana@correo.mx' });
    const { cuenta, auth, sesion } = preparar(
      { status: 422, cuerpo: { code: 422, error_code: 'email_exists', msg: 'Email address already exists' } },
      { status: 200, cuerpo: {} },
      { status: 200, cuerpo: sesionAuth(original) },
    );
    expect(await cuenta.pedirCodigo('ana@correo.mx')).toEqual({ ok: true, modo: 'entrar' });
    expect(auth.llamadas[1]?.url).toBe(`${URL_PROYECTO}/auth/v1/otp`);
    expect(auth.cuerpos()[1]).toEqual({ email: 'ana@correo.mx', create_user: false });
    const r = await cuenta.verificarCodigo('ana@correo.mx', '654321', 'entrar');
    expect(r).toMatchObject({ ok: true, usuarioId: ORIGINAL, conCorreo: true });
    expect(auth.cuerpos()[2]).toEqual({ type: 'email', email: 'ana@correo.mx', token: '654321' });
    expect(await sesion.obtenerToken()).toBe(original);
  });

  it('restaurar en un teléfono nuevo (soloEntrar): va directo al código de entrar sin crear un anónimo', async () => {
    const original = jwt(ORIGINAL, { is_anonymous: false, email: 'ana@correo.mx' });
    const { cuenta, auth, signups, sesion } = preparar(
      { status: 200, cuerpo: {} },
      { status: 200, cuerpo: sesionAuth(original) },
      { status: 400, cuerpo: { error_code: 'otp_disabled' } },
    );
    expect(await cuenta.pedirCodigo('ana@correo.mx', { soloEntrar: true })).toEqual({
      ok: true,
      modo: 'entrar',
    });
    expect(auth.llamadas.map((l) => l.url)).toEqual([`${URL_PROYECTO}/auth/v1/otp`]);
    expect(signups).toEqual([]);
    expect(await cuenta.verificarCodigo('ana@correo.mx', '654321', 'entrar')).toMatchObject({
      ok: true,
      usuarioId: ORIGINAL,
    });
    expect(await sesion.obtenerToken()).toBe(original);
    // Un correo sin cuenta: no hay respaldos que restaurar.
    expect(await cuenta.pedirCodigo('nadie@correo.mx', { soloEntrar: true })).toEqual({
      ok: false,
      error: 'sin_cuenta',
    });
  });

  it('GoTrue viejo sin error_code: el mensaje "already been registered" también lleva a entrar', async () => {
    const { cuenta } = preparar(
      { status: 422, cuerpo: { msg: 'A user with this email address has already been registered' } },
      { status: 200, cuerpo: {} },
    );
    expect(await cuenta.pedirCodigo('ana@correo.mx')).toEqual({ ok: true, modo: 'entrar' });
  });

  it('con una sesión de correo ya abierta, pedir código es entrar (no se cambia el correo)', async () => {
    const { cuenta, auth, almacen } = preparar({ status: 200, cuerpo: {} });
    almacen.guardar(
      CLAVE_SESION_NUBE,
      JSON.stringify({
        access_token: jwt(ORIGINAL, { is_anonymous: false, email: 'ana@correo.mx' }),
        refresh_token: 'rt',
        vence_en: Date.now() + 3_600_000,
      }),
    );
    expect(await cuenta.pedirCodigo('ana@correo.mx')).toEqual({ ok: true, modo: 'entrar' });
    expect(auth.llamadas.map((l) => l.url)).toEqual([`${URL_PROYECTO}/auth/v1/otp`]);
  });

  it('errores: correo o código mal escritos (sin red), límite, código vencido, sin cuenta, sin red', async () => {
    const { cuenta, auth } = preparar(
      { status: 429, cuerpo: { error_code: 'over_email_send_rate_limit' } },
      { status: 403, cuerpo: { error_code: 'otp_expired', msg: 'Token has expired or is invalid' } },
      'sin_red',
    );
    expect(await cuenta.pedirCodigo('ana@')).toEqual({ ok: false, error: 'correo_invalido' });
    expect(await cuenta.verificarCodigo('ana@correo.mx', '12a456', 'vincular')).toEqual({
      ok: false,
      error: 'codigo_invalido',
    });
    expect(auth.llamadas).toHaveLength(0);
    expect(await cuenta.pedirCodigo('ana@correo.mx')).toEqual({ ok: false, error: 'demasiados_intentos' });
    expect(await cuenta.verificarCodigo('ana@correo.mx', '123456', 'vincular')).toEqual({
      ok: false,
      error: 'codigo_invalido',
    });
    expect(await cuenta.verificarCodigo('ana@correo.mx', '123456', 'vincular')).toEqual({
      ok: false,
      error: 'sin_red',
    });

    const sinCuenta = preparar(
      { status: 422, cuerpo: { error_code: 'email_exists' } },
      { status: 422, cuerpo: { error_code: 'otp_disabled', msg: 'Signups not allowed for otp' } },
    );
    expect(await sinCuenta.cuenta.pedirCodigo('ana@correo.mx')).toEqual({ ok: false, error: 'sin_cuenta' });
  });

  it('un verify que devuelve una sesión anónima no se da por bueno', async () => {
    const { cuenta } = preparar({ status: 200, cuerpo: sesionAuth(JWT_ANONIMO) });
    expect(await cuenta.verificarCodigo('ana@correo.mx', '123456', 'vincular')).toEqual({
      ok: false,
      error: 'servidor',
    });
  });

  it('olvidarSesion (tras borrar la cuenta): la siguiente petición crea un anónimo nuevo', async () => {
    const { cuenta, sesion, signups } = preparar();
    expect(await sesion.obtenerToken()).toBe(JWT_ANONIMO);
    await cuenta.olvidarSesion();
    expect(await sesion.obtenerToken()).not.toBe(JWT_ANONIMO);
    expect(signups).toHaveLength(2);
  });
});

describe('claims y correo', () => {
  it('claimsDeToken distingue la sesión de correo de la anónima', () => {
    expect(claimsDeToken(jwt(ANONIMO, { is_anonymous: false, email: 'a@b.mx' }))).toEqual({
      usuarioId: ANONIMO,
      conCorreo: true,
      correo: 'a@b.mx',
    });
    // Sin el claim is_anonymous no se asume correo.
    expect(claimsDeToken(jwt(ANONIMO, { email: 'a@b.mx' }))?.conCorreo).toBe(false);
    expect(claimsDeToken(jwt('no-uuid'))).toBeNull();
    expect(claimsDeToken('basura')).toBeNull();
  });

  it('normalizarCorreo', () => {
    expect(normalizarCorreo(' Ana.Perez+cartera@Correo.com.mx ')).toBe('ana.perez+cartera@correo.com.mx');
    expect(normalizarCorreo('ana correo@x.mx')).toBeNull();
    expect(normalizarCorreo('ana@x')).toBeNull();
  });
});
