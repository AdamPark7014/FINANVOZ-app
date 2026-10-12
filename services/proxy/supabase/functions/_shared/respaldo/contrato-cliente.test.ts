// El cliente de la app (`apps/movil/src/nube/respaldo-nube.ts`) contra este manejador, con Storage en memoria y
// URLs firmadas del mismo proyecto: subir, listar, bajar y borrar la cuenta de punta a punta; dos cuentas no se
// ven (CA-M9-04, 05 y 07, partes servidor y cliente).
import { describe, expect, it } from 'vitest';
import type { FetchNube } from '../../../../../../apps/movil/src/nube/http.ts';
import { crearRespaldoNube } from '../../../../../../apps/movil/src/nube/respaldo-nube.ts';
import { type AlmacenRespaldos, crearManejadorRespaldo } from './manejador.ts';

const PROYECTO = 'https://abc.supabase.co';
const FIRMA = `${PROYECTO}/storage/v1/object/sign-test/`;
const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';

function proyecto() {
  const objetos = new Map<string, Uint8Array>();
  const borrados: string[] = [];
  let ahora = Date.UTC(2026, 9, 12, 15, 30, 0);
  const almacen: AlmacenRespaldos = {
    async listar(usuario) {
      return [...objetos.entries()]
        .filter(([r]) => r.startsWith(`${usuario}/`))
        .map(([r, b]) => ({
          nombre: r.slice(usuario.length + 1),
          tamano: b.length,
          creado_en: '2026-10-12T00:00:00Z',
        }));
    },
    firmarSubida: async (ruta) => `${FIRMA}subir/${ruta}`,
    firmarBajada: async (ruta) => `${FIRMA}bajar/${ruta}`,
    async borrar(rutas) {
      for (const r of rutas) objetos.delete(r);
    },
  };
  const manejador = crearManejadorRespaldo({
    configurado: true,
    verificarUsuario: async (jwt) =>
      ({ 'jwt-u1': { id: U1, conCorreo: true }, 'jwt-u2': { id: U2, conCorreo: true } })[jwt] ?? null,
    almacen,
    borrarUsuario: async (id) => {
      borrados.push(id);
    },
    ahora: () => (ahora += 86_400_000),
    registrar: () => {},
  });
  const fetch: FetchNube = async (url, p) => {
    if (url.startsWith(FIRMA)) {
      const [op, ...ruta] = url.slice(FIRMA.length).split('/');
      const clave = ruta.join('/');
      if (op === 'subir' && p.method === 'PUT') {
        objetos.set(clave, p.body as Uint8Array);
        return { status: 200, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
      }
      const b = objetos.get(clave);
      return {
        status: b ? 200 : 400,
        json: async () => ({}),
        arrayBuffer: async () => (b ? (b.slice().buffer as ArrayBuffer) : new ArrayBuffer(0)),
      };
    }
    const r = await manejador(
      new Request(url, {
        method: p.method,
        headers: p.headers,
        ...(typeof p.body === 'string' ? { body: p.body } : {}),
      }),
    );
    return { status: r.status, json: () => r.json(), arrayBuffer: () => r.arrayBuffer() };
  };
  const cliente = (jwt: string) =>
    crearRespaldoNube({ url: PROYECTO, sesion: { obtenerToken: async () => jwt }, fetch });
  return { objetos, borrados, cliente };
}

describe('contrato respaldo: cliente de la app ↔ proxy', () => {
  it('seis respaldos semanales dejan 4; se baja el mismo blob; otra cuenta no lo ve; borrar cuenta limpia', async () => {
    const { objetos, borrados, cliente } = proyecto();
    const ana = cliente('jwt-u1');
    const beto = cliente('jwt-u2');
    const nombres: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await ana.subir(new TextEncoder().encode(`blob-${i}`), 1);
      if (!r.ok) throw new Error(r.error);
      nombres.push(r.nombre);
    }
    await beto.subir(new TextEncoder().encode('blob-beto'), 1);
    const lista = await ana.listar();
    expect(lista.ok && lista.respaldos.map((x) => x.nombre)).toEqual(nombres.slice(2).reverse());
    const bajado = await ana.bajar(nombres[5] ?? '');
    expect(bajado.ok && new TextDecoder().decode(bajado.bytes)).toBe('blob-5');
    // Beto no lista ni baja los de Ana.
    const deBeto = await beto.listar();
    expect(deBeto.ok && deBeto.respaldos).toHaveLength(1);
    expect(await beto.bajar(nombres[5] ?? '')).toEqual({ ok: false, error: 'no_encontrado' });

    expect(await ana.borrarCuenta()).toEqual({ ok: true });
    expect([...objetos.keys()].every((r) => r.startsWith(U2))).toBe(true);
    expect(borrados).toEqual([U1]);
  });
});
