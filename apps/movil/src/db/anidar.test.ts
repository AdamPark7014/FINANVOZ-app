import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { BaseDatos } from '@cartera/datos';
import { conTransaccionesAnidables, transaccionesComoExpo } from './anidar';

function base(): BaseDatos {
  const cliente = new Database(':memory:');
  cliente.exec('create table t (v integer)');
  return transaccionesComoExpo(drizzle({ client: cliente }) as unknown as BaseDatos);
}

const valores = (db: BaseDatos) => db.all<{ v: number }>(sql`select v from t order by v`).map((f) => f.v);

describe('transacciones anidadas en la raíz (expo-sqlite)', () => {
  it('sin el envoltorio, una transacción dentro de otra falla como en el teléfono', () => {
    const db = base();
    expect(() => db.transaction(() => db.transaction(() => db.run(sql`insert into t values (1)`)))).toThrow(
      /begin/,
    );
  });

  it('con el envoltorio, la anidada es un savepoint y todo se confirma junto', () => {
    const db = conTransaccionesAnidables(base());
    db.transaction(() => {
      db.run(sql`insert into t values (1)`);
      db.transaction(() => db.run(sql`insert into t values (2)`));
    });
    expect(valores(db)).toEqual([1, 2]);
  });

  it('un error en la anidada deshace solo la anidada si la exterior lo atrapa', () => {
    const db = conTransaccionesAnidables(base());
    db.transaction(() => {
      db.run(sql`insert into t values (1)`);
      try {
        db.transaction(() => {
          db.run(sql`insert into t values (2)`);
          throw new Error('falla');
        });
      } catch {
        // la exterior sigue
      }
    });
    expect(valores(db)).toEqual([1]);
  });

  it('un error que sale de la exterior deshace todo', () => {
    const db = conTransaccionesAnidables(base());
    expect(() =>
      db.transaction(() => {
        db.run(sql`insert into t values (1)`);
        db.transaction(() => db.run(sql`insert into t values (2)`));
        throw new Error('falla');
      }),
    ).toThrow('falla');
    expect(valores(db)).toEqual([]);
    db.transaction(() => db.run(sql`insert into t values (3)`));
    expect(valores(db)).toEqual([3]);
  });
});
