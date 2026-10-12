// M9 · Edge Function `respaldo` con un Storage en memoria: URLs firmadas solo del prefijo propio (CA-M9-05, parte
// servidor), retención de los 4 más recientes (CA-M9-04, parte servidor), borrar la cuenta de punta a punta
// (CA-M9-07, parte servidor) y registros sin datos del usuario (regla 9).
import { describe, expect, it } from 'vitest';
import type { EventoRegistro } from '../nlu/registro.ts';
import { lineaRegistro } from '../nlu/registro.ts';
import {
  type AlmacenRespaldos,
  crearManejadorRespaldo,
  type DependenciasRespaldo,
  MAXIMO_RESPALDOS,
  nombreRespaldo,
  podar,
  type UsuarioVerificado,
} from './manejador.ts';

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const ANONIMO = '00000000-0000-4000-8000-000000000003';
const BASE = 'https://abc.supabase.co/functions/v1';
const T0 = Date.UTC(2026, 9, 12, 15, 30, 0);

const TOKENS: Record<string, UsuarioVerificado> = {
  'jwt-u1': { id: U1, conCorreo: true },
  'jwt-u2': { id: U2, conCorreo: true },
  'jwt-anonimo': { id: ANONIMO, conCorreo: false },
};

/** Storage en memoria: la URL firmada es `firmada://<operacion>/<ruta>` y solo sirve para esa ruta. */
function almacenEnMemoria() {
  const objetos = new Map<string, { bytes: Uint8Array; creado_en: string }>();
  const llamadas: string[] = [];
  let fallarBorrado = false;
  const almacen: AlmacenRespaldos = {
    async listar(usuarioId) {
      return [...objetos.entries()]
        .filter(([ruta]) => ruta.startsWith(`${usuarioId}/`))
        .map(([ruta, o]) => ({
          nombre: ruta.slice(usuarioId.length + 1),
          tamano: o.bytes.length,
          creado_en: o.creado_en,
        }));
    },
    async firmarSubida(ruta) {
      llamadas.push(`subir:${ruta}`);
      return `firmada://subir/${ruta}`;
    },
    async firmarBajada(ruta, segundos) {
      llamadas.push(`bajar:${ruta}:${segundos}`);
      return `firmada://bajar/${ruta}`;
    },
    async borrar(rutas) {
      llamadas.push(`borrar:${rutas.length}`);
      if (fallarBorrado) throw new Error(`no pude borrar ${rutas.join(',')}`);
      for (const r of rutas) objetos.delete(r);
    },
  };
  return {
    almacen,
    objetos,
    llamadas,
    fallarBorrados(si: boolean) {
      fallarBorrado = si;
    },
    /** Lo que hace Storage al recibir el PUT en la URL firmada (sin sobrescribir). */
    subirFirmado(url: string, bytes: Uint8Array, creado_en = new Date(T0).toISOString()) {
      const ruta = url.replace('firmada://subir/', '');
      if (objetos.has(ruta)) throw new Error('ya existe');
      objetos.set(ruta, { bytes, creado_en });
    },
    bajarFirmado(url: string) {
      return objetos.get(url.replace('firmada://bajar/', ''))?.bytes ?? null;
    },
  };
}

function preparar(o: { configurado?: boolean } = {}) {
  const memoria = almacenEnMemoria();
  const registros: EventoRegistro[] = [];
  const usuariosBorrados: string[] = [];
  let ahora = T0;
  const deps: DependenciasRespaldo = {
    configurado: o.configurado ?? true,
    async verificarUsuario(jwt) {
      return TOKENS[jwt] ?? null;
    },
    almacen: memoria.almacen,
    async borrarUsuario(id) {
      usuariosBorrados.push(id);
    },
    ahora: () => ahora,
    registrar: (e) => registros.push(e),
  };
  const manejador = crearManejadorRespaldo(deps);
  const pedir = async (
    metodo: string,
    ruta: string,
    o2: { jwt?: string | null; cuerpo?: unknown } = {},
  ): Promise<{ estado: number; cuerpo: Record<string, unknown> }> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const jwt = o2.jwt === undefined ? 'jwt-u1' : o2.jwt;
    if (jwt !== null) headers.authorization = `Bearer ${jwt}`;
    const r = await manejador(
      new Request(`${BASE}${ruta}`, {
        method: metodo,
        headers,
        ...(o2.cuerpo === undefined
          ? {}
          : { body: typeof o2.cuerpo === 'string' ? o2.cuerpo : JSON.stringify(o2.cuerpo) }),
      }),
    );
    return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
  };
  /** Ciclo completo de la app: pide la URL, sube los bytes y confirma con la lista (que poda). */
  const respaldar = async (jwt: string, bytes: Uint8Array) => {
    const url = await pedir('POST', '/respaldo/url', { jwt, cuerpo: { operacion: 'subir', version: 1 } });
    expect(url.estado).toBe(200);
    memoria.subirFirmado(String(url.cuerpo.url), bytes, new Date(ahora).toISOString());
    const lista = await pedir('GET', '/respaldo/lista', { jwt });
    ahora += 7 * 86_400_000;
    return { nombre: String(url.cuerpo.nombre), lista: lista.cuerpo.respaldos as { nombre: string }[] };
  };
  return { memoria, registros, usuariosBorrados, pedir, respaldar };
}

describe('nombres y retención', () => {
  it('el nombre lleva la fecha UTC del servidor y la versión del formato', () => {
    expect(nombreRespaldo(T0, 1)).toBe('20261012T153000Z-v1.cartera');
    expect(nombreRespaldo(Date.UTC(2027, 0, 2, 3, 4, 5), 12)).toBe('20270102T030405Z-v12.cartera');
  });

  it('conserva los 4 más recientes por fecha del nombre e ignora nombres ajenos al formato', () => {
    const o = (nombre: string) => ({ nombre, tamano: 1, creado_en: '2026-10-12T00:00:00Z' });
    const r = podar([
      o('20261001T000000Z-v1.cartera'),
      o('20261015T000000Z-v1.cartera'),
      o('otro.bin'),
      o('20261008T000000Z-v1.cartera'),
      o('20261029T000000Z-v2.cartera'),
      o('20261022T000000Z-v1.cartera'),
    ]);
    expect(r.conservar.map((x) => x.nombre)).toEqual([
      '20261029T000000Z-v2.cartera',
      '20261022T000000Z-v1.cartera',
      '20261015T000000Z-v1.cartera',
      '20261008T000000Z-v1.cartera',
    ]);
    expect(r.conservar[0]?.version).toBe(2);
    expect(r.borrar).toEqual(['20261001T000000Z-v1.cartera']);
  });
});

describe('POST /respaldo/url y GET /respaldo/lista', () => {
  it('subir: el servidor pone la ruta bajo el prefijo del usuario; la lista da fecha, tamaño y versión', async () => {
    const { pedir, memoria } = preparar();
    const r = await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'subir', version: 1 } });
    expect(r).toEqual({
      estado: 200,
      cuerpo: {
        nombre: '20261012T153000Z-v1.cartera',
        url: `firmada://subir/${U1}/20261012T153000Z-v1.cartera`,
        tamano_maximo: 13_107_200,
      },
    });
    memoria.subirFirmado(String(r.cuerpo.url), new Uint8Array(1234));
    expect(await pedir('GET', '/respaldo/lista')).toEqual({
      estado: 200,
      cuerpo: {
        respaldos: [
          {
            nombre: '20261012T153000Z-v1.cartera',
            tamano: 1234,
            creado_en: new Date(T0).toISOString(),
            version: 1,
          },
        ],
      },
    });
  });

  it('respaldo semanal: tras 6 semanas quedan solo los 4 más recientes (CA-M9-04, servidor)', async () => {
    const { respaldar, memoria } = preparar();
    const nombres: string[] = [];
    let lista: { nombre: string }[] = [];
    for (let semana = 0; semana < 6; semana++) {
      const r = await respaldar('jwt-u1', new Uint8Array([semana]));
      nombres.push(r.nombre);
      lista = r.lista;
      // Nunca hay más de 5 archivos (4 + el que se está subiendo) y, tras la lista, a lo más 4.
      expect(memoria.objetos.size).toBeLessThanOrEqual(MAXIMO_RESPALDOS);
    }
    expect(lista.map((x) => x.nombre)).toEqual(nombres.slice(2).reverse());
    expect([...memoria.objetos.keys()].sort()).toEqual(nombres.slice(2).map((n) => `${U1}/${n}`));
  });

  it('si la app no confirmó con la lista, el siguiente "subir" poda antes de firmar; si no puede, no firma', async () => {
    const { pedir, memoria } = preparar();
    for (let d = 1; d <= 5; d++) {
      memoria.objetos.set(`${U1}/2026100${d}T000000Z-v1.cartera`, {
        bytes: new Uint8Array(1),
        creado_en: '2026-10-01T00:00:00Z',
      });
    }
    memoria.fallarBorrados(true);
    expect(await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'subir', version: 1 } })).toEqual({
      estado: 500,
      cuerpo: { error: 'error_interno' },
    });
    // La lista sigue sirviendo aunque la poda falle (para restaurar), con los 4 más recientes.
    const lista = await pedir('GET', '/respaldo/lista');
    expect(lista.estado).toBe(200);
    expect((lista.cuerpo.respaldos as unknown[]).length).toBe(4);
    memoria.fallarBorrados(false);
    expect(
      (await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'subir', version: 1 } })).estado,
    ).toBe(200);
    expect(memoria.objetos.has(`${U1}/20261001T000000Z-v1.cartera`)).toBe(false);
    expect(memoria.objetos.size).toBe(4);
  });

  it('dos respaldos en el mismo segundo: el segundo recibe 409 ocupado', async () => {
    const { pedir, memoria } = preparar();
    const a = await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'subir', version: 1 } });
    memoria.subirFirmado(String(a.cuerpo.url), new Uint8Array(1));
    expect(await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'subir', version: 1 } })).toEqual({
      estado: 409,
      cuerpo: { error: 'ocupado' },
    });
  });

  it('bajar: URL de 5 minutos solo de un respaldo propio; el de otra cuenta no existe (CA-M9-05, servidor)', async () => {
    const { pedir, respaldar, memoria } = preparar();
    const propio = await respaldar('jwt-u1', new TextEncoder().encode('blob-u1'));
    const ajeno = await respaldar('jwt-u2', new TextEncoder().encode('blob-u2'));
    const r = await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'bajar', nombre: propio.nombre } });
    expect(r.estado).toBe(200);
    expect(new TextDecoder().decode(memoria.bajarFirmado(String(r.cuerpo.url)) ?? new Uint8Array())).toBe(
      'blob-u1',
    );
    expect(memoria.llamadas).toContain(`bajar:${U1}/${propio.nombre}:300`);
    // U1 pide el nombre del respaldo de U2: la ruta se arma con el prefijo de U1, así que no existe.
    expect(
      await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'bajar', nombre: ajeno.nombre } }),
    ).toEqual({ estado: 404, cuerpo: { error: 'no_encontrado' } });
    // Y la lista de U1 no muestra nada de U2.
    const lista = await pedir('GET', '/respaldo/lista');
    expect(lista.cuerpo.respaldos).toEqual([expect.objectContaining({ nombre: propio.nombre })]);
  });

  it('el nombre no puede salir del prefijo ni ser libre', async () => {
    const { pedir, memoria } = preparar();
    for (const nombre of [
      `../${U2}/20261012T153000Z-v1.cartera`,
      `${U2}/20261012T153000Z-v1.cartera`,
      'mis-finanzas.cartera',
      '20261012T153000Z-v0.cartera',
    ]) {
      expect((await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'bajar', nombre } })).estado).toBe(
        400,
      );
    }
    for (const cuerpo of [
      { operacion: 'subir' },
      { operacion: 'subir', version: 0 },
      { operacion: 'subir', version: 1.5 },
      { operacion: 'subir', version: 1, nombre: 'x.cartera' },
      { operacion: 'borrar', nombre: '20261012T153000Z-v1.cartera' },
      [],
      'no es json',
      { operacion: 'subir', version: 1, relleno: 'x'.repeat(2000) },
    ]) {
      expect((await pedir('POST', '/respaldo/url', { cuerpo })).estado).toBe(400);
    }
    expect(memoria.llamadas.filter((l) => l.startsWith('subir') || l.startsWith('bajar'))).toEqual([]);
  });

  it('autorización: sin JWT 401, sesión anónima 403 sin_correo, método o ruta equivocados, sin configurar', async () => {
    const { pedir } = preparar();
    expect(await pedir('GET', '/respaldo/lista', { jwt: null })).toEqual({
      estado: 401,
      cuerpo: { error: 'no_autorizado' },
    });
    expect((await pedir('GET', '/respaldo/lista', { jwt: 'jwt-falso' })).estado).toBe(401);
    expect(await pedir('GET', '/respaldo/lista', { jwt: 'jwt-anonimo' })).toEqual({
      estado: 403,
      cuerpo: { error: 'sin_correo' },
    });
    expect(
      (
        await pedir('POST', '/respaldo/url', {
          jwt: 'jwt-anonimo',
          cuerpo: { operacion: 'subir', version: 1 },
        })
      ).estado,
    ).toBe(403);
    expect((await pedir('DELETE', '/respaldo/cuenta', { jwt: 'jwt-anonimo' })).estado).toBe(403);
    expect((await pedir('GET', '/respaldo/url')).estado).toBe(405);
    expect((await pedir('POST', '/respaldo/lista')).estado).toBe(405);
    expect((await pedir('GET', '/respaldo/otra')).estado).toBe(404);
    expect((await preparar({ configurado: false }).pedir('GET', '/respaldo/lista')).estado).toBe(503);
  });
});

describe('DELETE /respaldo/cuenta (CA-M9-07, servidor)', () => {
  it('borra todos los archivos del prefijo (también los de otro nombre) y después el usuario; no toca otra cuenta', async () => {
    const { pedir, respaldar, memoria, usuariosBorrados } = preparar();
    await respaldar('jwt-u1', new Uint8Array(1));
    await respaldar('jwt-u1', new Uint8Array(2));
    await respaldar('jwt-u2', new Uint8Array(3));
    memoria.objetos.set(`${U1}/suelto.bin`, { bytes: new Uint8Array(1), creado_en: '2026-10-01T00:00:00Z' });
    expect(await pedir('DELETE', '/respaldo/cuenta')).toEqual({
      estado: 200,
      cuerpo: { resultado: 'borrada' },
    });
    expect([...memoria.objetos.keys()].filter((r) => r.startsWith(U1))).toEqual([]);
    expect([...memoria.objetos.keys()].filter((r) => r.startsWith(U2))).toHaveLength(1);
    expect(usuariosBorrados).toEqual([U1]);
  });

  it('si algún archivo no se pudo borrar, no borra el usuario y responde 500 (la app reintenta)', async () => {
    const { pedir, respaldar, memoria, usuariosBorrados } = preparar();
    await respaldar('jwt-u1', new Uint8Array(1));
    memoria.fallarBorrados(true);
    expect((await pedir('DELETE', '/respaldo/cuenta')).estado).toBe(500);
    expect(usuariosBorrados).toEqual([]);
    expect(memoria.objetos.size).toBe(1);
    memoria.fallarBorrados(false);
    expect((await pedir('DELETE', '/respaldo/cuenta')).estado).toBe(200);
    expect(memoria.objetos.size).toBe(0);
    expect(usuariosBorrados).toEqual([U1]);
  });
});

describe('registros (regla 9)', () => {
  it('solo ruta, operación y resultado: nunca el id del usuario, nombres de archivo, URLs ni tamaños', async () => {
    const { pedir, respaldar, registros, memoria } = preparar();
    const { nombre } = await respaldar('jwt-u1', new Uint8Array(4321));
    await pedir('POST', '/respaldo/url', { cuerpo: { operacion: 'bajar', nombre } });
    await pedir('GET', '/respaldo/lista', { jwt: 'jwt-anonimo' });
    memoria.fallarBorrados(true);
    await pedir('DELETE', '/respaldo/cuenta');
    const lineas = registros.map(lineaRegistro);
    expect(registros.map((r) => `${r.endpoint} ${r.codigo} ${r.estado_http}`)).toEqual([
      '/respaldo/url subir:ok 200',
      '/respaldo/lista lista:ok 200',
      '/respaldo/url bajar:ok 200',
      '/respaldo/lista sin_correo 403',
      '/respaldo/cuenta cuenta:error_interno 500',
    ]);
    for (const l of lineas) {
      expect(l).not.toContain(U1);
      expect(l).not.toContain(nombre);
      expect(l).not.toContain('4321');
      expect(l).not.toContain('firmada');
      expect(JSON.parse(l)).toMatchObject({ usuario_hash: null });
    }
  });
});
