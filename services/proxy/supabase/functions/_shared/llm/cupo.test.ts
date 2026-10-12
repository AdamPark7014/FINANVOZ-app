// M10 · `consumir_turno_llm` en PGlite con las migraciones reales: solo Plus (o Negocio) vigente y cada turno
// cuenta en el mismo cupo que el intérprete.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../nlu/__pruebas__/dobles.ts';
import { LIMITES_PLAN } from '../nlu/limites.ts';

const leer = (archivo: string) =>
  readFileSync(new URL(`../../../migrations/${archivo}`, import.meta.url), 'utf8');

const GRATIS = '00000000-0000-4000-8000-000000000001';
const PLUS = '00000000-0000-4000-8000-000000000002';
const VENCIDO = '00000000-0000-4000-8000-000000000003';

let db: PGlite;

async function consumir(usuario: string, tope = 1000): Promise<string> {
  const r = await db.query<{ r: string }>('select public.consumir_turno_llm($1, $2) as r', [usuario, tope]);
  return en(r.rows, 0).r;
}
async function usos(usuario: string): Promise<number> {
  const r = await db.query<{ u: number }>(
    'select coalesce(sum(usos), 0)::int as u from nlu_uso_diario where usuario_id = $1',
    [usuario],
  );
  return en(r.rows, 0).u;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${GRATIS}'), ('${PLUS}'), ('${VENCIDO}');
  `);
  await db.exec(leer('20261013000000_nlu_uso.sql'));
  await db.exec(leer('20261110000000_llm_turno.sql'));
});

beforeEach(async () => {
  await db.exec('truncate derechos, nlu_uso_diario, nlu_uso_global');
  await db.query(`insert into derechos (usuario_id, plan) values ($1, 'plus')`, [PLUS]);
  await db.query(
    `insert into derechos (usuario_id, plan, vigente_hasta) values ($1, 'plus', now() - interval '1 day')`,
    [VENCIDO],
  );
});

describe('consumir_turno_llm', () => {
  it('Gratis y Plus vencido: solo_plus sin consumir nada', async () => {
    expect(await consumir(GRATIS)).toBe('solo_plus');
    expect(await consumir(VENCIDO)).toBe('solo_plus');
    expect(await usos(GRATIS)).toBe(0);
    expect(await usos(VENCIDO)).toBe(0);
  });

  it('Plus: cada turno cuenta como una interpretación y respeta el límite diario', async () => {
    for (let i = 0; i < LIMITES_PLAN.plus.diario; i++) expect(await consumir(PLUS)).toBe('ok');
    expect(await consumir(PLUS)).toBe('limite_diario');
    expect(await usos(PLUS)).toBe(LIMITES_PLAN.plus.diario);
  });

  it('Plus: el tope global también aplica', async () => {
    expect(await consumir(PLUS, 1)).toBe('ok');
    expect(await consumir(PLUS, 1)).toBe('tope_global');
  });

  it('solo service_role puede ejecutarla', async () => {
    const r = await db.query<{ ok: boolean }>(
      `select has_function_privilege('authenticated', 'public.consumir_turno_llm(uuid, integer)', 'execute') as ok`,
    );
    expect(en(r.rows, 0).ok).toBe(false);
  });
});
