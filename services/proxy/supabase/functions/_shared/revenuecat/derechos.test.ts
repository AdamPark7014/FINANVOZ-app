// CA-M7-01 · las funciones SQL del webhook sobre la migración real (PGlite) y su efecto en el cupo del intérprete:
// Plus (también en prueba) da 300 al mes; al vencer o cancelar y vencer, vuelve a Gratis (30 al mes).
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../nlu/__pruebas__/dobles.ts';
import { LIMITES_PLAN } from '../nlu/limites.ts';

const leer = (nombre: string) =>
  readFileSync(new URL(`../../../migrations/${nombre}`, import.meta.url), 'utf8');

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const NADIE = '00000000-0000-4000-8000-0000000000ff';

let db: PGlite;
let secuencia = 0;

async function aplicar(o: {
  usuarios?: string[];
  plan?: 'gratis' | 'plus';
  vigenteHasta?: string | null;
  enPrueba?: boolean;
  eventoMs?: number;
  eventoId?: string;
}): Promise<string> {
  const r = await db.query<{ r: string }>(
    'select public.aplicar_derecho_revenuecat($1, $2::uuid[], $3, $4::timestamptz, $5, $6) as r',
    [
      o.eventoId ?? `evt-${++secuencia}`,
      o.usuarios ?? [U1],
      o.plan ?? 'plus',
      o.vigenteHasta === undefined ? new Date(Date.now() + 14 * 86_400_000).toISOString() : o.vigenteHasta,
      o.enPrueba ?? false,
      o.eventoMs ?? Date.now(),
    ],
  );
  return en(r.rows, 0).r;
}

async function derecho(usuario: string) {
  const r = await db.query<{ plan: string; en_prueba: boolean; vigente: boolean }>(
    `select plan, en_prueba, (vigente_hasta is null or vigente_hasta > now()) as vigente
     from derechos where usuario_id = $1`,
    [usuario],
  );
  return r.rows[0] ?? null;
}

/** Cuántas interpretaciones le quedan al usuario este mes con su plan efectivo (lo que aplica el proxy). */
async function cupoMensual(usuario: string): Promise<number> {
  await db.query('truncate nlu_uso_diario, nlu_uso_global');
  await db.query(
    `insert into nlu_uso_diario (usuario_id, dia, usos)
     values ($1, (now() at time zone 'America/Mexico_City')::date, $2)`,
    [usuario, LIMITES_PLAN.gratis.mensual],
  );
  const r = await db.query<{ r: string }>('select public.consumir_interpretacion($1, 1000) as r', [usuario]);
  return en(r.rows, 0).r === 'limite_mensual' ? LIMITES_PLAN.gratis.mensual : LIMITES_PLAN.plus.mensual;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${U1}'), ('${U2}');
  `);
  await db.exec(leer('20261013000000_nlu_uso.sql'));
  await db.exec(leer('20261015000000_revenuecat.sql'));
});

beforeEach(async () => {
  await db.exec('truncate derechos, nlu_uso_diario, nlu_uso_global, revenuecat_eventos');
});

describe('aplicar_derecho_revenuecat (CA-M7-01)', () => {
  it('la prueba de 14 días activa Plus en el proxy; al vencer sin pagar vuelve a Gratis', async () => {
    expect(await cupoMensual(U1)).toBe(LIMITES_PLAN.gratis.mensual);
    expect(await aplicar({ enPrueba: true, eventoMs: 1 })).toBe('aplicado');
    expect(await derecho(U1)).toEqual({ plan: 'plus', en_prueba: true, vigente: true });
    expect(await cupoMensual(U1)).toBe(LIMITES_PLAN.plus.mensual);

    expect(await aplicar({ plan: 'gratis', vigenteHasta: null, eventoMs: 2 })).toBe('aplicado');
    expect(await derecho(U1)).toEqual({ plan: 'gratis', en_prueba: false, vigente: true });
    expect(await cupoMensual(U1)).toBe(LIMITES_PLAN.gratis.mensual);
  });

  it('cancelar deja Plus hasta el vencimiento; pasado el vencimiento cuenta como Gratis aunque no llegue EXPIRATION', async () => {
    await aplicar({ eventoMs: 1 });
    await aplicar({ eventoMs: 2 }); // CANCELLATION: mismo vencimiento futuro
    expect(await cupoMensual(U1)).toBe(LIMITES_PLAN.plus.mensual);
    await aplicar({ eventoMs: 3, vigenteHasta: new Date(Date.now() - 1000).toISOString() });
    expect(await derecho(U1)).toMatchObject({ plan: 'plus', vigente: false });
    expect(await cupoMensual(U1)).toBe(LIMITES_PLAN.gratis.mensual);
  });

  it('el mismo evento dos veces se aplica una sola vez', async () => {
    expect(await aplicar({ eventoId: 'evt-x', eventoMs: 5 })).toBe('aplicado');
    expect(await aplicar({ eventoId: 'evt-x', plan: 'gratis', eventoMs: 6 })).toBe('duplicado');
    expect(await derecho(U1)).toMatchObject({ plan: 'plus' });
  });

  it('un evento viejo que llega tarde no pisa uno más nuevo', async () => {
    await aplicar({ plan: 'gratis', vigenteHasta: null, eventoMs: 200 });
    expect(await aplicar({ eventoMs: 100 })).toBe('antiguo');
    expect(await derecho(U1)).toMatchObject({ plan: 'gratis' });
  });

  it('usuarios que no existen no fallan: sin_usuario', async () => {
    expect(await aplicar({ usuarios: [NADIE] })).toBe('sin_usuario');
    expect(await aplicar({ usuarios: [NADIE, U2] })).toBe('aplicado');
    expect(await derecho(U2)).toMatchObject({ plan: 'plus' });
  });

  it('transferir mueve el Plus vigente al usuario nuevo y deja al anterior en Gratis', async () => {
    await aplicar({ usuarios: [U1], enPrueba: true, eventoMs: 1 });
    const r = await db.query<{ r: string }>(
      'select public.transferir_derecho_revenuecat($1, $2::uuid[], $3::uuid[], $4) as r',
      ['evt-t', [U1], [U2], 2],
    );
    expect(en(r.rows, 0).r).toBe('aplicado');
    expect(await derecho(U2)).toEqual({ plan: 'plus', en_prueba: true, vigente: true });
    expect(await derecho(U1)).toMatchObject({ plan: 'gratis' });
  });

  it('plan fuera de la lista se rechaza y solo service_role ejecuta', async () => {
    await expect(aplicar({ plan: 'negocio' as 'plus' })).rejects.toThrow();
    const r = await db.query<{ anon: boolean; servicio: boolean }>(`
      select has_function_privilege('anon', 'public.aplicar_derecho_revenuecat(text, uuid[], text, timestamptz, boolean, bigint)', 'execute') as anon,
             has_function_privilege('service_role', 'public.aplicar_derecho_revenuecat(text, uuid[], text, timestamptz, boolean, bigint)', 'execute') as servicio`);
    expect(r.rows[0]).toEqual({ anon: false, servicio: true });
  });
});
