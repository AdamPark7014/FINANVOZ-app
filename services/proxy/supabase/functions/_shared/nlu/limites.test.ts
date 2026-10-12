// CA-M3-04 · límites en la base: la migración real corre en PGlite (Postgres en WebAssembly), sin servidor.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { en } from './__pruebas__/dobles.ts';
import { LIMITES_PLAN, leerTopeGlobal } from './limites.ts';

const migracion = readFileSync(
  new URL('../../../migrations/20261013000000_nlu_uso.sql', import.meta.url),
  'utf8',
);

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';

let db: PGlite;

async function consumir(usuario: string, tope = 1000): Promise<string> {
  const r = await db.query<{ r: string }>('select public.consumir_interpretacion($1, $2) as r', [
    usuario,
    tope,
  ]);
  return en(r.rows, 0).r;
}
async function usosHoy(usuario: string): Promise<number> {
  const r = await db.query<{ usos: number }>(
    `select coalesce(sum(usos), 0)::int as usos from nlu_uso_diario
     where usuario_id = $1 and dia = (now() at time zone 'America/Mexico_City')::date`,
    [usuario],
  );
  return en(r.rows, 0).usos;
}
async function fijarUsos(usuario: string, usos: number, desplazamientoDias = 0) {
  await db.query(
    `insert into nlu_uso_diario (usuario_id, dia, usos)
     values ($1, (now() at time zone 'America/Mexico_City')::date + $3::int, $2)
     on conflict (usuario_id, dia) do update set usos = excluded.usos`,
    [usuario, usos, desplazamientoDias],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}');
  `);
  await db.exec(migracion);
});

beforeEach(async () => {
  await db.exec('truncate derechos, nlu_uso_diario, nlu_uso_global');
});

describe('consumir_interpretacion (CA-M3-04)', () => {
  it('Gratis: 20 al día y luego limite_diario, sin contar el rechazo', async () => {
    for (let i = 0; i < LIMITES_PLAN.gratis.diario; i++) expect(await consumir(U1)).toBe('ok');
    expect(await consumir(U1)).toBe('limite_diario');
    expect(await usosHoy(U1)).toBe(LIMITES_PLAN.gratis.diario);
    // Otro usuario no se ve afectado.
    expect(await consumir(U2)).toBe('ok');
  });

  it('Gratis: 30 al mes (el límite mensual tiene precedencia)', async () => {
    await fijarUsos(U1, LIMITES_PLAN.gratis.mensual);
    expect(await consumir(U1)).toBe('limite_mensual');
  });

  it('el uso del mes anterior no cuenta', async () => {
    const r = await db.query<{ d: number }>(
      `select extract(day from (now() at time zone 'America/Mexico_City'))::int as d`,
    );
    const dia = en(r.rows, 0).d;
    await fijarUsos(U1, 1000, -dia); // último día del mes anterior
    expect(await consumir(U1)).toBe('ok');
  });

  it('Plus: 60 al día y 300 al mes; un Plus vencido vuelve a Gratis', async () => {
    await db.query(`insert into derechos (usuario_id, plan) values ($1, 'plus')`, [U1]);
    for (let i = 0; i < LIMITES_PLAN.plus.diario; i++) expect(await consumir(U1)).toBe('ok');
    expect(await consumir(U1)).toBe('limite_diario');
    await fijarUsos(U1, LIMITES_PLAN.plus.mensual);
    expect(await consumir(U1)).toBe('limite_mensual');

    await db.query(
      `insert into derechos (usuario_id, plan, vigente_hasta) values ($1, 'plus', now() - interval '1 day')`,
      [U2],
    );
    await fijarUsos(U2, LIMITES_PLAN.gratis.diario);
    expect(await consumir(U2)).toBe('limite_diario');
  });

  it('tope global diario de todos los usuarios', async () => {
    expect(await consumir(U1, 2)).toBe('ok');
    expect(await consumir(U2, 2)).toBe('ok');
    expect(await consumir(U3, 2)).toBe('tope_global');
    expect(await usosHoy(U3)).toBe(0);
    expect(await consumir(U3, 0)).toBe('tope_global');
  });

  it('devolver_interpretacion regresa una al usuario y nunca baja de 0', async () => {
    expect(await consumir(U1)).toBe('ok');
    await db.query('select public.devolver_interpretacion($1)', [U1]);
    expect(await usosHoy(U1)).toBe(0);
    await db.query('select public.devolver_interpretacion($1)', [U1]);
    expect(await usosHoy(U1)).toBe(0);
  });

  it('solo service_role puede ejecutar las funciones', async () => {
    const r = await db.query<{ anon: boolean; servicio: boolean }>(`
      select has_function_privilege('anon', 'public.consumir_interpretacion(uuid, integer)', 'execute') as anon,
             has_function_privilege('service_role', 'public.consumir_interpretacion(uuid, integer)', 'execute') as servicio`);
    expect(r.rows[0]).toEqual({ anon: false, servicio: true });
  });
});

describe('leerTopeGlobal', () => {
  it('acepta enteros positivos y rechaza el resto', () => {
    expect(leerTopeGlobal('500')).toBe(500);
    expect(leerTopeGlobal(' 20 ')).toBe(20);
    for (const v of [undefined, '', '0', '-1', '1.5', 'mil']) expect(leerTopeGlobal(v)).toBeNull();
  });
});
