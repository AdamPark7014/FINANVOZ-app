// M16 · Edge Function `compartido` contra la migración real en PGlite: crear, unirse con el código de un solo uso,
// publicar y descargar en orden de llegada, una tercera cuenta sin acceso (CA-M16-04, parte servidor), cerrar el
// grupo (CA-M16-05, parte servidor), "Volver a vincular" con `/compartido/codigo` (CA-M16-06, parte servidor) y
// registros sin datos (regla 9).
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { lineaRegistro } from '../nlu/registro.ts';
import { abrirServidor, peticion, type ServidorPrueba } from './__pruebas__/servidor.ts';
import { aBase64Url, hashCodigo, INSTANTE, LIMITE_DESCARGA, VIGENCIA_CODIGO_MS } from './manejador.ts';

let s: ServidorPrueba;
let A: string;
let B: string;
let C: string;

beforeEach(async () => {
  s = await abrirServidor();
  [A, B, C] = [await s.usuario(), await s.usuario(), await s.usuario()];
});

const blob = (n = 120) => Buffer.from(randomBytes(n)).toString('base64');
const evento = () => ({ id: randomUUID(), blob: blob() });

async function llamar(usuario: string | null, ruta: string, cuerpo?: unknown) {
  const r = await s.manejador(peticion(usuario, ruta, cuerpo));
  return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

async function grupoDeDos() {
  const creado = await llamar(A, 'grupos');
  const grupo = creado.cuerpo.grupo_id as string;
  const unido = await llamar(B, 'unirse', { grupo_id: grupo, codigo_union: creado.cuerpo.codigo_union });
  expect(unido).toEqual({ estado: 200, cuerpo: { grupo_id: grupo, autor: 'b' } });
  return grupo;
}

const descargar = (usuario: string, grupo: string, desde?: string) =>
  llamar(usuario, `eventos?grupo_id=${grupo}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}`);

describe('POST /compartido/grupos y /unirse', () => {
  it('crea el grupo con quien lo crea como a y un código de 22 caracteres que vence en 10 min', async () => {
    const r = await llamar(A, 'grupos');
    expect(r.estado).toBe(200);
    expect(r.cuerpo.grupo_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.cuerpo.codigo_union).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const fila = (
      await s.db.query<{ codigo_union_hash: string; codigo_autor: string }>(
        'select codigo_union_hash, codigo_autor from grupos_compartidos',
      )
    ).rows[0];
    // El servidor guarda solo el hash del código, nunca el código.
    expect(fila).toEqual({
      codigo_union_hash: await hashCodigo(r.cuerpo.codigo_union as string),
      codigo_autor: 'b',
    });
    const miembros = await s.db.query('select usuario, autor from miembros_compartidos');
    expect(miembros.rows).toEqual([{ usuario: A, autor: 'a' }]);
  });

  it('el código es de un solo uso: una tercera cuenta ya no puede usarlo', async () => {
    const creado = await llamar(A, 'grupos');
    const datos = { grupo_id: creado.cuerpo.grupo_id, codigo_union: creado.cuerpo.codigo_union };
    expect((await llamar(B, 'unirse', datos)).estado).toBe(200);
    expect(await llamar(C, 'unirse', datos)).toEqual({ estado: 403, cuerpo: { error: 'codigo_invalido' } });
    const codigos = await s.db.query('select codigo_union_hash from grupos_compartidos');
    expect(codigos.rows).toEqual([{ codigo_union_hash: null }]);
  });

  it('un código equivocado o vencido no sirve', async () => {
    const creado = await llamar(A, 'grupos');
    const grupo = creado.cuerpo.grupo_id;
    const otro = aBase64Url(new Uint8Array(randomBytes(16)));
    expect((await llamar(B, 'unirse', { grupo_id: grupo, codigo_union: otro })).cuerpo).toEqual({
      error: 'codigo_invalido',
    });
    s.fijarAhora(Date.now() - VIGENCIA_CODIGO_MS - 1000);
    const viejo = await llamar(A, 'codigo', { grupo_id: grupo });
    expect(viejo.estado).toBe(200);
    expect(
      (await llamar(B, 'unirse', { grupo_id: grupo, codigo_union: viejo.cuerpo.codigo_union })).cuerpo,
    ).toEqual({ error: 'codigo_invalido' });
  });

  it('quien ya ocupa el otro lugar no puede tomar este', async () => {
    const creado = await llamar(A, 'grupos');
    expect(
      await llamar(A, 'unirse', {
        grupo_id: creado.cuerpo.grupo_id,
        codigo_union: creado.cuerpo.codigo_union,
      }),
    ).toEqual({ estado: 409, cuerpo: { error: 'ya_miembro' } });
  });
});

describe('CA-M16-04 · eventos: solo miembros, solo texto cifrado', () => {
  it('cada quien publica con su autor; los dos descargan todo en orden de llegada', async () => {
    const grupo = await grupoDeDos();
    const e1 = evento();
    const e2 = evento();
    const pa = await llamar(A, 'eventos', { grupo_id: grupo, eventos: [e1] });
    expect(pa.estado).toBe(200);
    expect(pa.cuerpo.eventos).toEqual([{ id: e1.id, recibido_en: expect.stringMatching(INSTANTE) }]);
    expect((await llamar(B, 'eventos', { grupo_id: grupo, eventos: [e2] })).estado).toBe(200);
    for (const quien of [A, B]) {
      const r = await descargar(quien, grupo);
      expect(r.estado).toBe(200);
      expect(
        (r.cuerpo.eventos as { id: string; autor: string; blob: string }[]).map((e) => [
          e.id,
          e.autor,
          e.blob,
        ]),
      ).toEqual([
        [e1.id, 'a', e1.blob],
        [e2.id, 'b', e2.blob],
      ]);
      expect(r.cuerpo).toMatchObject({ mas: false, cerrado_en: null });
    }
  });

  it('publicar es idempotente por id; el mismo id con otro blob es conflicto', async () => {
    const grupo = await grupoDeDos();
    const e = evento();
    const primero = await llamar(A, 'eventos', { grupo_id: grupo, eventos: [e] });
    const repetido = await llamar(A, 'eventos', { grupo_id: grupo, eventos: [e] });
    expect(repetido.cuerpo).toEqual(primero.cuerpo);
    expect(await llamar(A, 'eventos', { grupo_id: grupo, eventos: [{ ...e, blob: blob() }] })).toEqual({
      estado: 409,
      cuerpo: { error: 'conflicto' },
    });
    expect((await s.db.query('select count(*)::int as n from eventos_compartidos')).rows).toEqual([{ n: 1 }]);
  });

  it('una tercera cuenta no puede leer, publicar, pedir código ni cerrar el grupo (403 no_miembro)', async () => {
    const grupo = await grupoDeDos();
    await llamar(A, 'eventos', { grupo_id: grupo, eventos: [evento()] });
    const prohibido = { estado: 403, cuerpo: { error: 'no_miembro' } };
    expect(await descargar(C, grupo)).toEqual(prohibido);
    expect(await llamar(C, 'eventos', { grupo_id: grupo, eventos: [evento()] })).toEqual(prohibido);
    expect(await llamar(C, 'codigo', { grupo_id: grupo })).toEqual(prohibido);
    expect(await llamar(C, 'salir', { grupo_id: grupo })).toEqual(prohibido);
    // Un grupo que no existe responde igual (no se puede saber si existe).
    expect(await descargar(C, randomUUID())).toEqual(prohibido);
    expect((await s.db.query('select count(*)::int as n from eventos_compartidos')).rows).toEqual([{ n: 1 }]);
  });

  it('la tabla guarda solo grupo_id, id, autor, blob y recibido_en', async () => {
    const columnas = await s.db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'eventos_compartidos' order by 1`,
    );
    expect(columnas.rows.map((c) => c.column_name)).toEqual([
      'autor',
      'blob',
      'grupo_id',
      'id',
      'recibido_en',
    ]);
    const grupos = await s.db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'grupos_compartidos' order by 1`,
    );
    expect(grupos.rows.map((c) => c.column_name)).toEqual([
      'cerrado_en',
      'codigo_autor',
      'codigo_union_hash',
      'codigo_vence_en',
      'creado_en',
      'id',
    ]);
  });

  it('pagina la descarga y el cursor no salta eventos', async () => {
    const grupo = await grupoDeDos();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const lote = Array.from({ length: 50 }, evento);
      ids.push(...lote.map((e) => e.id));
      expect((await llamar(i % 2 ? A : B, 'eventos', { grupo_id: grupo, eventos: lote })).estado).toBe(200);
    }
    const vistos = new Set<string>();
    let desde: string | undefined;
    let paginas = 0;
    for (;;) {
      const r = await descargar(A, grupo, desde);
      paginas++;
      for (const e of r.cuerpo.eventos as { id: string }[]) vistos.add(e.id);
      desde = r.cuerpo.cursor as string;
      if (!r.cuerpo.mas) break;
    }
    expect(paginas).toBe(Math.ceil(250 / LIMITE_DESCARGA));
    expect([...vistos].sort()).toEqual([...ids].sort());
    // Lo recién publicado vuelve a llegar mientras esté dentro del margen de 30 s (la app lo descarta por id).
    const otra = await descargar(A, grupo, desde);
    expect(otra.cuerpo.cursor).toBe(desde);
  });
});

describe('CA-M16-05 · salir cierra el grupo para los dos', () => {
  it('desde el cierre nadie publica (403 grupo_cerrado), los dos siguen descargando y salir es idempotente', async () => {
    const grupo = await grupoDeDos();
    const deA = evento();
    await llamar(A, 'eventos', { grupo_id: grupo, eventos: [deA] });
    const cierre = await llamar(A, 'salir', { grupo_id: grupo });
    expect(cierre.estado).toBe(200);
    expect(cierre.cuerpo.cerrado_en).toMatch(INSTANTE);
    expect(await llamar(A, 'salir', { grupo_id: grupo })).toEqual(cierre);
    const cerrado = { estado: 403, cuerpo: { error: 'grupo_cerrado' } };
    expect(await llamar(A, 'eventos', { grupo_id: grupo, eventos: [evento()] })).toEqual(cerrado);
    expect(await llamar(B, 'eventos', { grupo_id: grupo, eventos: [evento()] })).toEqual(cerrado);
    expect(await llamar(B, 'codigo', { grupo_id: grupo })).toEqual(cerrado);
    const r = await descargar(B, grupo);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.cerrado_en).toBe(cierre.cuerpo.cerrado_en);
    expect((r.cuerpo.eventos as { id: string }[]).map((e) => e.id)).toEqual([deA.id]);
    // Todo lo publicado quedó antes del cierre.
    const [fila] = (
      await s.db.query<{ antes: boolean }>(
        'select bool_and(e.recibido_en <= g.cerrado_en) as antes from eventos_compartidos e join grupos_compartidos g on g.id = e.grupo_id',
      )
    ).rows;
    expect(fila?.antes).toBe(true);
  });
});

describe('CA-M16-06 · volver a vincular', () => {
  it('la otra persona pide un código; la sesión nueva ocupa el lugar y la anterior pierde el acceso', async () => {
    const grupo = await grupoDeDos();
    await llamar(B, 'eventos', { grupo_id: grupo, eventos: [evento()] });
    const nuevaB = await s.usuario();
    expect(await descargar(nuevaB, grupo)).toEqual({ estado: 403, cuerpo: { error: 'no_miembro' } });
    const codigo = await llamar(A, 'codigo', { grupo_id: grupo });
    expect(codigo.estado).toBe(200);
    expect(
      await llamar(nuevaB, 'unirse', { grupo_id: grupo, codigo_union: codigo.cuerpo.codigo_union }),
    ).toEqual({
      estado: 200,
      cuerpo: { grupo_id: grupo, autor: 'b' },
    });
    expect((await descargar(nuevaB, grupo)).estado).toBe(200);
    expect(await descargar(B, grupo)).toEqual({ estado: 403, cuerpo: { error: 'no_miembro' } });
    expect(
      (await s.db.query('select usuario from miembros_compartidos where autor = $1', ['b'])).rows,
    ).toEqual([{ usuario: nuevaB }]);
  });

  it('el mismo usuario (restaurado desde la nube) puede volver a ocupar su propio lugar', async () => {
    const grupo = await grupoDeDos();
    const codigo = await llamar(A, 'codigo', { grupo_id: grupo });
    expect(
      (await llamar(B, 'unirse', { grupo_id: grupo, codigo_union: codigo.cuerpo.codigo_union })).estado,
    ).toBe(200);
  });
});

describe('contrato y registros', () => {
  it('rechaza sin JWT, métodos, rutas y cuerpos fuera del contrato', async () => {
    const grupo = await grupoDeDos();
    expect((await llamar(null, 'grupos')).estado).toBe(401);
    expect((await s.manejador(peticion(A, 'grupos', undefined, 'GET'))).status).toBe(405);
    expect((await llamar(A, 'otra')).estado).toBe(404);
    for (const [ruta, cuerpo] of [
      ['grupos', { extra: 1 }],
      ['codigo', { grupo_id: 'x' }],
      ['unirse', { grupo_id: grupo, codigo_union: 'corto' }],
      ['eventos', { grupo_id: grupo, eventos: [] }],
      ['eventos', { grupo_id: grupo, eventos: [{ id: randomUUID(), blob: 'no base64!' }] }],
      ['eventos', { grupo_id: grupo, eventos: [{ id: randomUUID(), blob: 'QUJD' }] }],
      ['eventos', { grupo_id: grupo, eventos: Array.from({ length: 51 }, evento) }],
    ] as const) {
      expect((await llamar(A, ruta, cuerpo)).cuerpo, ruta).toEqual({ error: 'solicitud_invalida' });
    }
    const e = evento();
    expect((await llamar(A, 'eventos', { grupo_id: grupo, eventos: [e, e] })).estado).toBe(400);
    expect((await llamar(A, `eventos?grupo_id=${grupo}&desde=ayer`)).estado).toBe(400);
  });

  it('los registros llevan solo ruta y código: ni usuarios, ni grupos, ni ids, ni blobs', async () => {
    const grupo = await grupoDeDos();
    const e = evento();
    await llamar(A, 'eventos', { grupo_id: grupo, eventos: [e] });
    await descargar(C, grupo);
    const lineas = s.registros.map(lineaRegistro).join('\n');
    for (const dato of [A, B, C, grupo, e.id, e.blob.slice(0, 20)]) expect(lineas).not.toContain(dato);
    expect(s.registros.map((r) => `${r.endpoint}:${r.codigo}`)).toEqual([
      '/compartido/grupos:ok',
      '/compartido/unirse:ok',
      '/compartido/eventos:ok',
      '/compartido/eventos:no_miembro',
    ]);
  });
});
