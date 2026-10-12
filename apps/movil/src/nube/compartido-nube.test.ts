import { describe, expect, it } from 'vitest';
import { crearClienteCompartido, RUTA_COMPARTIDO } from './compartido-nube';
import type { FetchNube, PeticionNube } from './http';

const URL_PROYECTO = 'https://abc.supabase.co';
const GRUPO = '0b9f3c1e-7a51-4c1b-9d6e-2f4a8c3b5d71';
const INSTANTE = '2026-10-12T15:30:00.123456Z';

function respuesta(status: number, cuerpo: unknown) {
  return { status, json: async () => cuerpo, arrayBuffer: async () => new ArrayBuffer(0) };
}

function cliente(responder: (url: string, p: PeticionNube, token: string) => ReturnType<typeof respuesta>) {
  const llamadas: { url: string; peticion: PeticionNube }[] = [];
  let tokens = 0;
  const fetch: FetchNube = async (url, peticion) => {
    llamadas.push({ url, peticion });
    return responder(url, peticion, peticion.headers.Authorization ?? '');
  };
  const c = crearClienteCompartido({
    url: `${URL_PROYECTO}/`,
    sesion: { obtenerToken: async (o) => (o?.renovar ? `jwt-${++tokens}` : 'jwt-0') },
    fetch,
  });
  return { c, llamadas };
}

describe('cliente de /compartido/*', () => {
  it('llama la Edge Function con el JWT y traduce la respuesta', async () => {
    const { c, llamadas } = cliente((url) =>
      url.includes('/eventos?')
        ? respuesta(200, {
            eventos: [{ id: 'e1', autor: 'b', blob: 'QUJD', recibido_en: INSTANTE }],
            cursor: INSTANTE,
            mas: false,
            cerrado_en: null,
          })
        : respuesta(200, { grupo_id: GRUPO, codigo_union: 'x'.repeat(22), vence_en: INSTANTE }),
    );
    expect(await c.crearGrupo()).toEqual({ ok: true, grupoId: GRUPO, codigoUnion: 'x'.repeat(22) });
    expect(await c.descargar(GRUPO, INSTANTE)).toEqual({
      ok: true,
      eventos: [{ id: 'e1', autor: 'b', blob: 'QUJD', recibidoEn: INSTANTE }],
      cursor: INSTANTE,
      mas: false,
      cerradoEn: null,
    });
    expect(llamadas[0]).toMatchObject({
      url: `${URL_PROYECTO}${RUTA_COMPARTIDO}/grupos`,
      peticion: { method: 'POST', headers: { Authorization: 'Bearer jwt-0' }, body: '{}' },
    });
    expect(llamadas[1]?.url).toBe(
      `${URL_PROYECTO}${RUTA_COMPARTIDO}/eventos?grupo_id=${GRUPO}&desde=${encodeURIComponent(INSTANTE)}`,
    );
    expect(llamadas[1]?.peticion.method).toBe('GET');
  });

  it('ante un 401 renueva el token una vez', async () => {
    const { c, llamadas } = cliente((_u, _p, token) =>
      token === 'Bearer jwt-0'
        ? respuesta(401, { error: 'no_autorizado' })
        : respuesta(200, { cerrado_en: INSTANTE }),
    );
    expect(await c.salir(GRUPO)).toEqual({ ok: true, cerradoEn: INSTANTE });
    expect(llamadas.map((l) => l.peticion.headers.Authorization)).toEqual(['Bearer jwt-0', 'Bearer jwt-1']);
    const siempre401 = cliente(() => respuesta(401, {}));
    expect(await siempre401.c.salir(GRUPO)).toEqual({ ok: false, error: 'sin_sesion' });
  });

  it('traduce los códigos del servidor; sin red o con una respuesta rara no truena', async () => {
    for (const [estado, codigo, esperado] of [
      [403, 'no_miembro', 'no_miembro'],
      [403, 'grupo_cerrado', 'grupo_cerrado'],
      [403, 'codigo_invalido', 'codigo_invalido'],
      [409, 'ya_miembro', 'ya_miembro'],
      [409, 'conflicto', 'conflicto'],
      [500, 'error_interno', 'servidor'],
    ] as const) {
      const { c } = cliente(() => respuesta(estado, { error: codigo }));
      expect(await c.publicar(GRUPO, [{ id: 'e1', blob: 'QUJD' }])).toEqual({ ok: false, error: esperado });
    }
    const raro = cliente(() => respuesta(200, { otra: 'cosa' }));
    expect(await raro.c.unirse(GRUPO, 'x'.repeat(22))).toEqual({ ok: false, error: 'servidor' });
    const sinRed = crearClienteCompartido({
      url: URL_PROYECTO,
      sesion: { obtenerToken: async () => 'jwt' },
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    expect(await sinRed.pedirCodigo(GRUPO)).toEqual({ ok: false, error: 'sin_red' });
    const sinSesion = crearClienteCompartido({
      url: URL_PROYECTO,
      sesion: { obtenerToken: async () => null },
    });
    expect(await sinSesion.crearGrupo()).toEqual({ ok: false, error: 'sin_sesion' });
  });
});
