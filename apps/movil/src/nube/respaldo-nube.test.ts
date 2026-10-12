import { describe, expect, it } from 'vitest';
import type { FetchNube, PeticionNube } from './http';
import { crearRespaldoNube, TAMANO_MAXIMO_RESPALDO } from './respaldo-nube';
import type { SesionNube } from './sesion';

const URL_PROYECTO = 'https://abc.supabase.co';
const FUNCION = `${URL_PROYECTO}/functions/v1/respaldo`;
const STORAGE = `${URL_PROYECTO}/storage/v1/object`;

/**
 * Doble del proxy con el contrato de `services/proxy/.../respaldo/manejador.ts` (rutas, cuerpos y errores) y de
 * Storage (PUT/GET en URLs firmadas). `jwt-correo` es una sesión de correo; `jwt-anonimo`, una anónima.
 */
function servidorFalso(o: { maximo?: number } = {}) {
  const objetos = new Map<string, Uint8Array>();
  const llamadas: { url: string; peticion: PeticionNube }[] = [];
  let segundo = 0;
  let rechazarToken: string | null = null;
  let sinRed = false;
  const respuesta = (status: number, cuerpo: unknown = {}, bytes?: Uint8Array) => ({
    status,
    json: async () => cuerpo,
    arrayBuffer: async () => {
      const b = bytes ?? new Uint8Array();
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    },
  });
  const lista = () =>
    [...objetos.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([nombre, b]) => ({
        nombre,
        tamano: b.length,
        creado_en: '2026-10-12T15:30:00.000Z',
        version: 1,
      }));
  const fetch: FetchNube = async (url, peticion) => {
    llamadas.push({ url, peticion });
    if (sinRed) throw new TypeError('Network request failed');
    if (url.startsWith(FUNCION)) {
      const token = /^Bearer (.+)$/.exec(peticion.headers.Authorization ?? '')?.[1];
      if (!token || token === rechazarToken) return respuesta(401, { error: 'no_autorizado' });
      if (token !== 'jwt-correo') return respuesta(403, { error: 'sin_correo' });
      const ruta = url.slice(FUNCION.length);
      if (ruta === '/lista' && peticion.method === 'GET') {
        const todos = lista();
        for (const x of todos.slice(o.maximo ?? 4)) objetos.delete(x.nombre);
        return respuesta(200, { respaldos: todos.slice(0, o.maximo ?? 4) });
      }
      if (ruta === '/cuenta' && peticion.method === 'DELETE') {
        objetos.clear();
        return respuesta(200, { resultado: 'borrada' });
      }
      if (ruta === '/url' && peticion.method === 'POST') {
        const c = JSON.parse(String(peticion.body)) as {
          operacion: string;
          version?: number;
          nombre?: string;
        };
        if (c.operacion === 'subir') {
          const nombre = `2026101${segundo++}T153000Z-v${c.version}.cartera`;
          return respuesta(200, {
            nombre,
            url: `${STORAGE}/upload/sign/respaldos/u1/${nombre}?token=t`,
            tamano_maximo: TAMANO_MAXIMO_RESPALDO,
          });
        }
        if (!objetos.has(c.nombre ?? '')) return respuesta(404, { error: 'no_encontrado' });
        return respuesta(200, { nombre: c.nombre, url: `${STORAGE}/sign/respaldos/u1/${c.nombre}?token=t` });
      }
      return respuesta(404, { error: 'ruta' });
    }
    const firmada = /\/respaldos\/u1\/([^?]+)\?token=t$/.exec(url)?.[1];
    if (url.startsWith(`${STORAGE}/upload/sign/`) && peticion.method === 'PUT' && firmada) {
      if (objetos.has(firmada)) return respuesta(409);
      objetos.set(firmada, peticion.body as Uint8Array);
      return respuesta(200, { Key: firmada });
    }
    if (url.startsWith(`${STORAGE}/sign/`) && peticion.method === 'GET' && firmada) {
      const b = objetos.get(firmada);
      return b ? respuesta(200, {}, b) : respuesta(400, { error: 'not_found' });
    }
    return respuesta(404);
  };
  return {
    fetch,
    objetos,
    llamadas,
    rechazar(token: string | null) {
      rechazarToken = token;
    },
    cortarRed(si: boolean) {
      sinRed = si;
    },
  };
}

function sesionFija(...tokens: (string | null)[]): SesionNube & { pedidos: boolean[] } {
  const pedidos: boolean[] = [];
  return {
    pedidos,
    async obtenerToken(o) {
      pedidos.push(o?.renovar === true);
      return (tokens.length > 1 ? tokens.shift() : tokens[0]) ?? null;
    },
  };
}

const bytes = (texto: string) => new TextEncoder().encode(texto);

describe('respaldo en la nube (cliente)', () => {
  it('subir: pide la URL, sube los bytes al Storage del proyecto y confirma con la lista', async () => {
    const servidor = servidorFalso();
    const nube = crearRespaldoNube({
      url: `${URL_PROYECTO}/`,
      sesion: sesionFija('jwt-correo'),
      fetch: servidor.fetch,
    });
    const r = await nube.subir(bytes('blob-cifrado'), 1);
    expect(r).toEqual({
      ok: true,
      nombre: '20261010T153000Z-v1.cartera',
      respaldos: [
        {
          nombre: '20261010T153000Z-v1.cartera',
          tamano: 12,
          creadoEn: '2026-10-12T15:30:00.000Z',
          version: 1,
        },
      ],
    });
    expect(servidor.llamadas.map((l) => `${l.peticion.method} ${l.url.split('?')[0]}`)).toEqual([
      `POST ${FUNCION}/url`,
      `PUT ${STORAGE}/upload/sign/respaldos/u1/20261010T153000Z-v1.cartera`,
      `GET ${FUNCION}/lista`,
    ]);
    expect(JSON.parse(String(servidor.llamadas[0]?.peticion.body))).toEqual({
      operacion: 'subir',
      version: 1,
    });
    expect(servidor.llamadas[0]?.peticion.headers).toMatchObject({ Authorization: 'Bearer jwt-correo' });
    // Los bytes van tal cual a Storage, sin el JWT.
    expect(servidor.llamadas[1]?.peticion.headers).toEqual({
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'false',
    });
  });

  it('listar y bajar: la lista trae fecha, tamaño y versión; bajar devuelve los mismos bytes', async () => {
    const servidor = servidorFalso();
    const nube = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija('jwt-correo'),
      fetch: servidor.fetch,
    });
    for (const t of ['uno', 'dos', 'tres', 'cuatro', 'cinco'])
      expect((await nube.subir(bytes(t), 1)).ok).toBe(true);
    const lista = await nube.listar();
    if (!lista.ok) throw new Error(lista.error);
    // El servidor conserva los 4 más recientes.
    expect(lista.respaldos.map((x) => x.nombre)).toEqual([
      '20261014T153000Z-v1.cartera',
      '20261013T153000Z-v1.cartera',
      '20261012T153000Z-v1.cartera',
      '20261011T153000Z-v1.cartera',
    ]);
    const r = await nube.bajar('20261012T153000Z-v1.cartera');
    expect(r.ok && new TextDecoder().decode(r.bytes)).toBe('tres');
    expect(await nube.bajar('20261010T153000Z-v1.cartera')).toEqual({ ok: false, error: 'no_encontrado' });
  });

  it('un 401 renueva el token una vez; si sigue, sin_sesion', async () => {
    const servidor = servidorFalso();
    servidor.rechazar('jwt-viejo');
    const sesion = sesionFija('jwt-viejo', 'jwt-correo');
    const nube = crearRespaldoNube({ url: URL_PROYECTO, sesion, fetch: servidor.fetch });
    expect(await nube.listar()).toEqual({ ok: true, respaldos: [] });
    expect(sesion.pedidos).toEqual([false, true]);

    const siempre = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija('jwt-viejo'),
      fetch: servidor.fetch,
    });
    expect(await siempre.listar()).toEqual({ ok: false, error: 'sin_sesion' });
    const sinToken = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija(null),
      fetch: servidor.fetch,
    });
    expect(await sinToken.listar()).toEqual({ ok: false, error: 'sin_sesion' });
  });

  it('con la sesión anónima el servidor responde sin_correo (hay que entrar con el correo)', async () => {
    const servidor = servidorFalso();
    const nube = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija('jwt-anonimo'),
      fetch: servidor.fetch,
    });
    expect(await nube.subir(bytes('x'), 1)).toEqual({ ok: false, error: 'sin_correo' });
    expect(await nube.listar()).toEqual({ ok: false, error: 'sin_correo' });
    expect(servidor.objetos.size).toBe(0);
  });

  it('demasiado grande: no pide URL; sin red: sin_red y nada a medias', async () => {
    const servidor = servidorFalso();
    const nube = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija('jwt-correo'),
      fetch: servidor.fetch,
    });
    expect(await nube.subir(new Uint8Array(TAMANO_MAXIMO_RESPALDO + 1), 1)).toEqual({
      ok: false,
      error: 'demasiado_grande',
    });
    expect(servidor.llamadas).toHaveLength(0);
    servidor.cortarRed(true);
    expect(await nube.subir(bytes('x'), 1)).toEqual({ ok: false, error: 'sin_red' });
    expect(await nube.bajar('20261010T153000Z-v1.cartera')).toEqual({ ok: false, error: 'sin_red' });
    expect(await nube.borrarCuenta()).toEqual({ ok: false, error: 'sin_red' });
  });

  it('nunca manda los bytes a una URL fuera del Storage del proyecto', async () => {
    const llamadas: string[] = [];
    const fetch: FetchNube = async (url) => {
      llamadas.push(url);
      return {
        status: 200,
        json: async () => ({ nombre: '20261010T153000Z-v1.cartera', url: 'https://otro.example/subir' }),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    };
    const nube = crearRespaldoNube({ url: URL_PROYECTO, sesion: sesionFija('jwt-correo'), fetch });
    expect(await nube.subir(bytes('blob'), 1)).toEqual({ ok: false, error: 'servidor' });
    expect(await nube.bajar('20261010T153000Z-v1.cartera')).toEqual({ ok: false, error: 'servidor' });
    expect(llamadas.every((u) => u.startsWith(FUNCION))).toBe(true);
  });

  it('borrarCuenta: DELETE /respaldo/cuenta deja el servidor sin archivos', async () => {
    const servidor = servidorFalso();
    const nube = crearRespaldoNube({
      url: URL_PROYECTO,
      sesion: sesionFija('jwt-correo'),
      fetch: servidor.fetch,
    });
    await nube.subir(bytes('uno'), 1);
    expect(await nube.borrarCuenta()).toEqual({ ok: true });
    expect(servidor.llamadas.at(-1)).toMatchObject({
      url: `${FUNCION}/cuenta`,
      peticion: { method: 'DELETE' },
    });
    expect(servidor.objetos.size).toBe(0);
  });
});
