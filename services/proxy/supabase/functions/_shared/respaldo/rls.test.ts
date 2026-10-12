// CA-M9-05 (parte RLS) · la migración real del bucket `respaldos` en PGlite, con el rol `authenticated` y los
// claims del JWT como los pone Storage: una cuenta de respaldo no puede listar, bajar, subir ni borrar objetos de
// otra; una sesión anónima no toca el bucket. `storage.*` y `auth.*` son un doble mínimo de los de Supabase.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migracion = readFileSync(
  new URL('../../../migrations/20261101000000_respaldo.sql', import.meta.url),
  'utf8',
);

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const ANONIMO = '00000000-0000-4000-8000-000000000003';
const nombre = (usuario: string, n = 1) => `${usuario}/2026101${n}T120000Z-v1.cartera`;

let db: PGlite;

/** Ejecuta como Storage con el JWT de `usuario` (`is_anonymous` como lo emite Supabase Auth). */
async function como<T>(usuario: string, sql: string, params: unknown[] = [], anonimo = false): Promise<T[]> {
  const claims = JSON.stringify({ sub: usuario, role: 'authenticated', is_anonymous: anonimo });
  await db.exec(
    `set role authenticated; set request.jwt.claim.sub = '${usuario}'; set request.jwt.claims = '${claims}';`,
  );
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claims;');
  }
}

const insertar = (usuario: string, nombreObjeto: string, anonimo = false) =>
  como(
    usuario,
    `insert into storage.objects (bucket_id, name, owner, metadata) values ('respaldos', $1, $2, '{"size": 10}')`,
    [nombreObjeto, usuario],
    anonimo,
  );

const listar = (usuario: string, anonimo = false) =>
  como<{ name: string }>(
    usuario,
    `select name from storage.objects where bucket_id = 'respaldos' order by name`,
    [],
    anonimo,
  ).then((filas) => filas.map((f) => f.name));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema auth to authenticated, anon;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    insert into auth.users values ('${U1}'), ('${U2}'), ('${ANONIMO}');

    create schema storage;
    grant usage on schema storage to authenticated, anon;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null,
      owner uuid,
      created_at timestamptz default now(),
      metadata jsonb,
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
    -- Otro bucket con una política abierta: las de respaldos no deben dar acceso fuera de su bucket ni verse
    -- afectadas por él.
    insert into storage.buckets (id, name) values ('otro', 'otro');
  `);
  await db.exec(migracion);
});

beforeEach(async () => {
  await db.exec('truncate storage.objects');
});

describe('bucket respaldos (RLS)', () => {
  it('es privado, de 12.5 MB por archivo y solo binario', async () => {
    const r = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'respaldos'`,
    );
    expect(r.rows[0]).toEqual({
      public: false,
      file_size_limit: 13107200,
      allowed_mime_types: ['application/octet-stream'],
    });
  });

  it('cada cuenta ve y borra solo lo suyo: no puede listar ni bajar respaldos de otra', async () => {
    await insertar(U1, nombre(U1, 1));
    await insertar(U1, nombre(U1, 2));
    await insertar(U2, nombre(U2, 1));
    expect(await listar(U1)).toEqual([nombre(U1, 1), nombre(U1, 2)]);
    expect(await listar(U2)).toEqual([nombre(U2, 1)]);
    // Bajar = leer la fila del objeto por su nombre exacto: para otra cuenta no existe.
    expect(
      await como(U1, `select id from storage.objects where bucket_id = 'respaldos' and name = $1`, [
        nombre(U2, 1),
      ]),
    ).toEqual([]);
    // Borrar lo ajeno no borra nada; lo propio sí.
    await como(U1, `delete from storage.objects where name = $1`, [nombre(U2, 1)]);
    await como(U1, `delete from storage.objects where name = $1`, [nombre(U1, 1)]);
    const todos = (await db.query<{ name: string }>('select name from storage.objects order by name')).rows;
    expect(todos.map((f) => f.name)).toEqual([nombre(U1, 2), nombre(U2, 1)]);
  });

  it('no puede subir bajo el prefijo de otra cuenta ni con un nombre fuera del formato', async () => {
    await expect(insertar(U1, nombre(U2))).rejects.toThrow(/row-level security/);
    await expect(insertar(U1, `${U1}/mis-finanzas.cartera`)).rejects.toThrow(/row-level security/);
    await expect(insertar(U1, `${U1}/sub/${nombre(U1)}`)).rejects.toThrow(/row-level security/);
    await expect(insertar(U1, `${U1}x/20261011T120000Z-v1.cartera`)).rejects.toThrow(/row-level security/);
    await insertar(U1, nombre(U1));
    expect(await listar(U1)).toEqual([nombre(U1)]);
  });

  it('no hay política de UPDATE: un respaldo no se sobrescribe ni se mueve a otro prefijo', async () => {
    await insertar(U1, nombre(U1));
    await como(U1, `update storage.objects set name = $1 where name = $2`, [nombre(U2), nombre(U1)]);
    await como(U1, `update storage.objects set metadata = '{"size": 1}' where name = $1`, [nombre(U1)]);
    const fila = (
      await db.query<{ name: string; metadata: { size: number } }>('select * from storage.objects')
    ).rows[0];
    expect(fila).toMatchObject({ name: nombre(U1), metadata: { size: 10 } });
  });

  it('una sesión anónima (o sin el claim is_anonymous) no lista, no sube y no borra', async () => {
    await insertar(U1, nombre(U1));
    await expect(insertar(ANONIMO, nombre(ANONIMO), true)).rejects.toThrow(/row-level security/);
    expect(await listar(ANONIMO, true)).toEqual([]);
    // El dueño con un token anónimo (antes de vincular el correo) tampoco ve lo suyo.
    expect(await listar(U1, true)).toEqual([]);
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${U1}'; set request.jwt.claims = '{"sub":"${U1}"}';`,
    );
    try {
      expect((await db.query(`select name from storage.objects`)).rows).toEqual([]);
    } finally {
      await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claims;');
    }
  });

  it('sin sesión (rol anon) no ve nada y no sube nada', async () => {
    await insertar(U1, nombre(U1));
    await db.exec('set role anon;');
    try {
      expect((await db.query(`select name from storage.objects`)).rows).toEqual([]);
      await expect(
        db.query(`insert into storage.objects (bucket_id, name) values ('respaldos', $1)`, [nombre(U1, 3)]),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec('reset role;');
    }
  });

  it('las políticas no abren otros buckets', async () => {
    await expect(
      como(U1, `insert into storage.objects (bucket_id, name) values ('otro', $1)`, [nombre(U1)]),
    ).rejects.toThrow(/row-level security/);
  });
});
