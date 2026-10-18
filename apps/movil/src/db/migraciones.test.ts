import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import type { BaseDatos } from '@cartera/datos';
import {
  CARPETA_MIGRACIONES,
  MODULO_GENERADO,
  generarModuloMigraciones,
} from '../../scripts/generar-migraciones';
import { abrirBaseCifrada, type PuertoSqlite } from './abrir';
import { CLAVE_LLAVE_BASE, almacenEnMemoria, pragmaLlave } from './llave';
import { MIGRACIONES } from './migraciones.generado';
import { migrar } from './migrar';
import { aleatorioNode, puertoNode } from './node';

function esquemaDe(cliente: Database.Database): unknown[] {
  return cliente
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE '__drizzle%' ORDER BY type, name",
    )
    .all();
}

describe('migraciones embebidas', () => {
  it('el módulo generado coincide con packages/datos/migraciones (corre `pnpm --filter movil migraciones`)', async () => {
    expect(readFileSync(MODULO_GENERADO, 'utf8')).toBe(await generarModuloMigraciones());
  });

  it('producen el mismo esquema y la misma marca que el migrador de Drizzle para Node', () => {
    const propia = new Database(':memory:');
    const aplicadas = migrar(drizzle({ client: propia }) as unknown as BaseDatos, MIGRACIONES);
    expect(aplicadas).toEqual(MIGRACIONES.map((m) => m.etiqueta));

    const referencia = new Database(':memory:');
    migrate(drizzle({ client: referencia }), { migrationsFolder: CARPETA_MIGRACIONES });
    expect(esquemaDe(propia)).toEqual(esquemaDe(referencia));
    const marcas = (c: Database.Database) =>
      c.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at').all();
    expect(marcas(propia)).toEqual(marcas(referencia));
  });

  it('son idempotentes: la segunda corrida no aplica nada', () => {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente }) as unknown as BaseDatos;
    migrar(db, MIGRACIONES);
    expect(migrar(db, MIGRACIONES)).toEqual([]);
  });

  it('una migración que falla no deja nada a medias', () => {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente }) as unknown as BaseDatos;
    migrar(db, MIGRACIONES);
    const rota = {
      idx: 99,
      etiqueta: '9999_rota',
      cuando: Number.MAX_SAFE_INTEGER,
      puntosDeCorte: true,
      hash: 'x',
      sql: 'CREATE TABLE nueva (id TEXT);\n--> statement-breakpoint\nESTO NO ES SQL;',
    };
    expect(() => migrar(db, [...MIGRACIONES, rota])).toThrow();
    expect(cliente.prepare("SELECT name FROM sqlite_master WHERE name = 'nueva'").all()).toEqual([]);
  });

  it('coinciden en número y orden con el journal, y su `when` es estrictamente creciente', () => {
    const journal = JSON.parse(readFileSync(`${CARPETA_MIGRACIONES}/meta/_journal.json`, 'utf8')) as {
      entries: { idx: number; when: number; tag: string }[];
    };
    expect(MIGRACIONES.map((m) => [m.idx, m.etiqueta, m.cuando])).toEqual(
      journal.entries.map((e) => [e.idx, e.tag, e.when]),
    );
    const cuandos = MIGRACIONES.map((m) => m.cuando);
    expect(cuandos.every((c, i) => i === 0 || c > (cuandos[i - 1] ?? Infinity))).toBe(true);
  });

  it('falla cerrado si aparece una migración anterior a la última aplicada sin registrar', () => {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente }) as unknown as BaseDatos;
    migrar(db, MIGRACIONES);
    const marcas = () => cliente.prepare('SELECT hash, created_at FROM __drizzle_migrations').all();
    const antes = marcas();
    const intrusa = {
      idx: 99,
      etiqueta: '0001b_intrusa',
      cuando: (MIGRACIONES[0]?.cuando ?? 0) + 1,
      puntosDeCorte: false,
      hash: 'y',
      sql: 'CREATE TABLE intrusa (id TEXT);',
    };
    const nueva = {
      ...intrusa,
      etiqueta: '9999_nueva',
      cuando: Number.MAX_SAFE_INTEGER,
      sql: 'CREATE TABLE nueva (id TEXT);',
    };
    let codigo: string | undefined;
    try {
      migrar(db, [...MIGRACIONES, intrusa, nueva]);
    } catch (e) {
      codigo = e instanceof ErrorDominio ? e.codigo : undefined;
    }
    expect(codigo).toBe('migracion_fuera_de_orden');
    expect(
      cliente.prepare("SELECT name FROM sqlite_master WHERE name IN ('intrusa', 'nueva')").all(),
    ).toEqual([]);
    expect(marcas()).toEqual(antes);
  });

  it('una base con solo las primeras migraciones aplica las siguientes sin falsos positivos', () => {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente }) as unknown as BaseDatos;
    migrar(db, MIGRACIONES.slice(0, 2));
    expect(migrar(db, MIGRACIONES)).toEqual(MIGRACIONES.slice(2).map((m) => m.etiqueta));
  });
});

describe('apertura cifrada', () => {
  it('aplica PRAGMA key antes de cualquier otra sentencia y reutiliza la llave guardada', () => {
    const almacen = almacenEnMemoria();
    const sentencias: string[] = [];
    const base = puertoNode();
    const espia: PuertoSqlite = {
      abrir() {
        const cliente = base.abrir();
        return {
          ejecutar: (s) => {
            sentencias.push(s);
            cliente.ejecutar(s);
          },
          drizzle: () => cliente.drizzle(),
          cerrar: () => cliente.cerrar(),
        };
      },
      eliminarArchivo: () => base.eliminarArchivo(),
    };
    let generadas = 0;
    const aleatorio = (n: number) => {
      generadas++;
      return aleatorioNode(n);
    };
    const primera = abrirBaseCifrada({ puerto: espia, almacen, aleatorio });
    const llave = almacen.obtener(CLAVE_LLAVE_BASE);
    expect(llave).toMatch(/^[0-9a-f]{64}$/);
    expect(sentencias[0]).toBe(pragmaLlave(llave as string));
    primera.cerrar();

    abrirBaseCifrada({ puerto: espia, almacen, aleatorio }).cerrar();
    expect(generadas).toBe(1);
    expect(almacen.obtener(CLAVE_LLAVE_BASE)).toBe(llave);
  });

  it('rechaza una llave guardada con formato inválido sin reemplazarla', () => {
    const almacen = almacenEnMemoria();
    almacen.guardar(CLAVE_LLAVE_BASE, 'no-es-hex');
    expect(() => abrirBaseCifrada({ puerto: puertoNode(), almacen, aleatorio: aleatorioNode })).toThrow(
      /llave/,
    );
    expect(almacen.obtener(CLAVE_LLAVE_BASE)).toBe('no-es-hex');
  });
});
