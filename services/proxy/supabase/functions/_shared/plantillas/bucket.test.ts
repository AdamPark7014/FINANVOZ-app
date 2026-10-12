// M10 · bucket público `plantillas` (docs/07-CAPTURA.md §3.1): las migraciones reales en PGlite, con
// `storage.*` y `auth.*` como doble mínimo de Supabase (igual que `_shared/respaldo/rls.test.ts`). La lectura es
// por la ruta pública de Storage; ningún JWT (anon ni authenticated, anónimo o de correo) puede subir, cambiar ni
// borrar las plantillas: solo el panel o la service role, que se salta RLS.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const leer = (nombre: string) =>
  readFileSync(new URL(`../../../migrations/${nombre}`, import.meta.url), 'utf8');
const U1 = '00000000-0000-4000-8000-000000000001';

let db: PGlite;

async function como(rol: 'anon' | 'authenticated', sql: string, anonimo = false): Promise<void> {
  const claims = JSON.stringify({ sub: U1, role: rol, is_anonymous: anonimo });
  await db.exec(
    `set role ${rol}; set request.jwt.claim.sub = '${U1}'; set request.jwt.claims = '${claims}';`,
  );
  try {
    await db.query(sql);
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claims;');
  }
}

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
    insert into auth.users values ('${U1}');
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
      metadata jsonb,
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated, anon;
  `);
  await db.exec(leer('20261101000000_respaldo.sql'));
  await db.exec(leer('20261110000000_plantillas.sql'));
  // Lo que publica Adam con la service role (sin RLS).
  await db.exec(`insert into storage.objects (bucket_id, name) values ('plantillas', 'plantillas.json')`);
});

describe('bucket plantillas', () => {
  it('es público, de 1 MB y solo JSON o texto', async () => {
    const r = await db.query(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'plantillas'`,
    );
    expect(r.rows[0]).toEqual({
      public: true,
      file_size_limit: 1048576,
      allowed_mime_types: ['application/json', 'text/plain', 'application/octet-stream'],
    });
  });

  it.each([
    ['anon', false],
    ['authenticated', true],
    ['authenticated', false],
  ] as const)('%s (anónimo: %s) no sube, no cambia ni borra plantillas', async (rol, anonimo) => {
    await expect(
      como(
        rol,
        `insert into storage.objects (bucket_id, name) values ('plantillas', 'plantillas.json.sig')`,
        anonimo,
      ),
    ).rejects.toThrow(/row-level security/);
    await como(rol, `update storage.objects set name = 'otro.json' where bucket_id = 'plantillas'`, anonimo);
    await como(rol, `delete from storage.objects where bucket_id = 'plantillas'`, anonimo);
    const r = await db.query<{ name: string }>(
      `select name from storage.objects where bucket_id = 'plantillas'`,
    );
    expect(r.rows.map((f) => f.name)).toEqual(['plantillas.json']);
  });
});
