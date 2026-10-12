// M7 · evidencia del consentimiento en el servidor (08 §2, checklist §7.1): la migración real en PGlite, con
// RLS como el rol `authenticated` de una sesión anónima.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migracion = readFileSync(
  new URL('../../migrations/20261020000100_consentimiento.sql', import.meta.url),
  'utf8',
);

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';

let db: PGlite;

/** Ejecuta como la app con la sesión anónima `usuario` (lo que hace PostgREST con el JWT). */
async function comoApp<T>(usuario: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${usuario}';`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub;');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users values ('${U1}'), ('${U2}');
  `);
  await db.exec(migracion);
});

beforeEach(async () => {
  await db.exec('truncate consentimiento');
});

describe('consentimiento (servidor)', () => {
  it('la app inserta su evidencia y queda ligada a su usuario anónimo, con la hora del servidor', async () => {
    await comoApp(U1, 'insert into public.consentimiento (version_aviso, aceptado_en) values ($1, $2)', [
      '2026-10-m7',
      '2026-10-11T16:00:00Z',
    ]);
    const filas = (
      await db.query<{ usuario_id: string; version_aviso: string; aceptado_en: Date; recibido_en: Date }>(
        'select * from consentimiento',
      )
    ).rows;
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ usuario_id: U1, version_aviso: '2026-10-m7' });
    expect(filas[0]?.aceptado_en.toISOString()).toBe('2026-10-11T16:00:00.000Z');
    expect(filas[0]?.recibido_en).toBeInstanceOf(Date);
  });

  it('no puede escribir a nombre de otro usuario, ni leer, cambiar o borrar evidencias', async () => {
    await expect(
      comoApp(
        U1,
        'insert into public.consentimiento (usuario_id, version_aviso, aceptado_en) values ($1, $2, now())',
        [U2, 'x'],
      ),
    ).rejects.toThrow();
    await comoApp(U1, `insert into public.consentimiento (version_aviso, aceptado_en) values ('v', now())`);
    await expect(comoApp(U1, 'select * from public.consentimiento')).rejects.toThrow();
    await expect(comoApp(U1, `update public.consentimiento set version_aviso = 'otra'`)).rejects.toThrow();
    await expect(comoApp(U1, 'delete from public.consentimiento')).rejects.toThrow();
    // La misma versión dos veces es un conflicto (la app lo trata como ya enviada).
    await expect(
      comoApp(U1, `insert into public.consentimiento (version_aviso, aceptado_en) values ('v', now())`),
    ).rejects.toThrow(/duplicate key/);
    expect((await db.query('select * from consentimiento')).rows).toHaveLength(1);
  });

  it('sin sesión (anon) no se inserta nada', async () => {
    await db.exec('set role anon;');
    try {
      await expect(
        db.query(`insert into public.consentimiento (version_aviso, aceptado_en) values ('v', now())`),
      ).rejects.toThrow();
    } finally {
      await db.exec('reset role;');
    }
  });

  it('al borrar el usuario de Auth se borra su evidencia', async () => {
    await comoApp(U2, `insert into public.consentimiento (version_aviso, aceptado_en) values ('v', now())`);
    await db.exec(`delete from auth.users where id = '${U2}'`);
    expect((await db.query('select * from consentimiento')).rows).toHaveLength(0);
    await db.exec(`insert into auth.users values ('${U2}')`);
  });
});
