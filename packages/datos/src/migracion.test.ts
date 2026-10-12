import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { ErrorDominio } from '@cartera/core';
import { abrirBase, C, migrar } from './__pruebas__/base';
import { TABLAS_0001 } from './esquema';
import {
  CATEGORIAS_GASTO_FIJO,
  CATEGORIAS_GASTO_VARIABLE,
  CATEGORIAS_INGRESO,
  CUENTAS_SISTEMA,
  idCategoria,
} from './semillas';
import { construirGasto } from '@cartera/core';

const TABLAS = Object.keys(TABLAS_0001).sort();

function codigo(f: () => unknown): string | undefined {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorDominio) return e.codigo;
    throw e;
  }
  return undefined;
}

function conGasto() {
  const base = abrirBase();
  const { transaccion: tx } = base.libro.registrar({
    ...construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 2500 }),
    fecha: '2026-10-12',
    origen: 'voz',
    claveIdempotencia: 'k1',
  });
  return { ...base, tx };
}

describe('CA-M1-03 · migración 0001_inicial', () => {
  it('crea todas las tablas de 04 §3, la vista y los triggers', () => {
    const { cliente } = abrirBase({ vacia: true });
    const objetos = cliente
      .prepare(
        `SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'`,
      )
      .all() as { type: string; name: string }[];
    const de = (tipo: string) =>
      objetos
        .filter((o) => o.type === tipo)
        .map((o) => o.name)
        .sort();
    expect(de('table')).toEqual(TABLAS);
    expect(de('view')).toEqual(['transaccion_vigente']);
    expect(de('trigger')).toEqual([
      'asiento_inmutable_d',
      'asiento_inmutable_u',
      'reversa_no_anulable',
      'transaccion_campos_fijos',
      'transaccion_inmutable_d',
    ]);
    expect(de('index')).toEqual(
      expect.arrayContaining([
        'cuenta_categoria',
        'cuenta_activas',
        'cuenta_ultimos4',
        'alias_cuenta_texto',
        'transaccion_fecha',
        'asiento_cuenta',
        'asiento_transaccion',
        'programado_un_horizonte',
        'captura_huella',
      ]),
    );
  });

  it('el esquema Drizzle declara exactamente las columnas del SQL', () => {
    const { cliente } = abrirBase({ vacia: true });
    for (const [nombre, tabla] of Object.entries(TABLAS_0001)) {
      const sqlCols = (cliente.prepare(`PRAGMA table_info(${nombre})`).all() as { name: string }[])
        .map((c) => c.name)
        .sort();
      const drizzleCols = getTableConfig(tabla)
        .columns.map((c) => c.name)
        .sort();
      expect(drizzleCols, nombre).toEqual(sqlCols);
    }
  });

  it('inserta las seis cuentas de sistema y el catálogo personal', () => {
    const { cliente } = abrirBase({ vacia: true });
    const sistema = cliente
      .prepare(`SELECT id, naturaleza, subtipo FROM cuenta WHERE categoria_slug IS NULL ORDER BY id`)
      .all();
    expect(sistema).toEqual(
      [
        { id: CUENTAS_SISTEMA.ajusteConciliacion, naturaleza: 'capital', subtipo: 'ajuste_conciliacion' },
        { id: CUENTAS_SISTEMA.cuentasExternas, naturaleza: 'activo', subtipo: 'externa' },
        { id: CUENTAS_SISTEMA.porAsignar, naturaleza: 'pasivo', subtipo: 'por_asignar' },
        { id: CUENTAS_SISTEMA.porAsignarEntradas, naturaleza: 'activo', subtipo: 'por_asignar_entradas' },
        { id: CUENTAS_SISTEMA.saldosIniciales, naturaleza: 'capital', subtipo: 'saldos_iniciales' },
        { id: CUENTAS_SISTEMA.transito, naturaleza: 'activo', subtipo: 'transito' },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    const sistemaFlags = cliente
      .prepare(`SELECT COUNT(*) AS n FROM cuenta WHERE id LIKE 'sis:%' AND sistema = 1 AND liquida = 0`)
      .get() as { n: number };
    expect(sistemaFlags.n).toBe(6);

    const categorias = cliente
      .prepare(
        `SELECT id, naturaleza, categoria_slug AS slug, tipo_gasto FROM cuenta WHERE categoria_slug IS NOT NULL`,
      )
      .all() as { id: string; naturaleza: string; slug: string; tipo_gasto: string | null }[];
    const por = (naturaleza: string, tipo: string | null) =>
      categorias
        .filter((c) => c.naturaleza === naturaleza && c.tipo_gasto === tipo)
        .map((c) => c.slug)
        .sort();
    expect(por('gasto', 'variable')).toEqual([...CATEGORIAS_GASTO_VARIABLE].sort());
    expect(por('gasto', 'fijo')).toEqual([...CATEGORIAS_GASTO_FIJO].sort());
    expect(por('ingreso', null)).toEqual([...CATEGORIAS_INGRESO].sort());
    expect(categorias.every((c) => c.id === idCategoria(c.slug))).toBe(true);
  });

  it('volver a migrar no aplica nada dos veces', () => {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente });
    migrar(db);
    migrar(db);
    expect((cliente.prepare('SELECT COUNT(*) AS n FROM cuenta').get() as { n: number }).n).toBe(36);
  });
});

describe('CA-M1-03 · inmutabilidad por trigger o CHECK', () => {
  it('UPDATE sobre asiento falla', () => {
    const { cliente } = conGasto();
    expect(() => cliente.prepare('UPDATE asiento SET monto = 1').run()).toThrow(/asiento inmutable/);
  });

  it('DELETE sobre asiento falla', () => {
    const { cliente } = conGasto();
    expect(() => cliente.prepare('DELETE FROM asiento').run()).toThrow(/asiento inmutable/);
  });

  it('DELETE sobre transaccion falla', () => {
    const { cliente } = conGasto();
    expect(() => cliente.prepare('DELETE FROM transaccion').run()).toThrow(/transaccion inmutable/);
  });

  it('cambiar fecha o tipo de una transacción falla', () => {
    const { cliente, tx } = conGasto();
    expect(() =>
      cliente.prepare(`UPDATE transaccion SET fecha = '2026-10-13' WHERE id = ?`).run(tx.id),
    ).toThrow(/campo inmutable/);
    expect(() => cliente.prepare(`UPDATE transaccion SET tipo = 'ingreso' WHERE id = ?`).run(tx.id)).toThrow(
      /campo inmutable/,
    );
    for (const campo of [
      'origen',
      'estimada',
      'clave_idempotencia',
      'revierte_a',
      'reemplaza_a',
      'registrada_en',
    ]) {
      expect(
        () => cliente.prepare(`UPDATE transaccion SET ${campo} = NULL WHERE id = ?`).run(tx.id),
        campo,
      ).toThrow(/campo inmutable/);
    }
  });

  it('los campos no financieros sí se editan', () => {
    const { cliente, tx } = conGasto();
    cliente
      .prepare(
        `UPDATE transaccion SET descripcion = 'coca', extraordinaria = 1, por_revisar = 1 WHERE id = ?`,
      )
      .run(tx.id);
  });

  it('anular dos veces la misma transacción falla (Libro y UNIQUE de revierte_a)', () => {
    const { cliente, libro, tx } = conGasto();
    libro.anular(tx.id);
    expect(codigo(() => libro.anular(tx.id))).toBe('ya_anulada');
    expect(() =>
      cliente
        .prepare(
          `INSERT INTO transaccion (id, fecha, registrada_en, tipo, origen, clave_idempotencia, revierte_a)
           VALUES ('x', '2026-10-12', 0, 'reversa', 'sistema', 'otra-clave', ?)`,
        )
        .run(tx.id),
    ).toThrow(/UNIQUE constraint failed: transaccion.revierte_a/);
  });

  it('anular una reversa falla (Libro y trigger)', () => {
    const { cliente, libro, tx } = conGasto();
    const reversa = libro.anular(tx.id);
    expect(codigo(() => libro.anular(reversa.id))).toBe('reversa_no_anulable');
    expect(() =>
      cliente
        .prepare(
          `INSERT INTO transaccion (id, fecha, registrada_en, tipo, origen, clave_idempotencia, revierte_a)
           VALUES ('x', '2026-10-12', 0, 'reversa', 'sistema', 'otra-clave', ?)`,
        )
        .run(reversa.id),
    ).toThrow(/una reversa no se anula/);
  });

  it('CHECK: tipo reversa ⇔ revierte_a; tipo fuera de lista; monto 0', () => {
    const { cliente, tx } = conGasto();
    const insertar = (tipo: string, revierte: string | null, clave: string) =>
      cliente
        .prepare(
          `INSERT INTO transaccion (id, fecha, registrada_en, tipo, origen, clave_idempotencia, revierte_a)
           VALUES (?, '2026-10-12', 0, ?, 'sistema', ?, ?)`,
        )
        .run(clave, tipo, clave, revierte);
    expect(() => insertar('reversa', null, 'a')).toThrow(/CHECK constraint failed/);
    expect(() => insertar('gasto', tx.id, 'b')).toThrow(/CHECK constraint failed/);
    expect(() => insertar('regalo', null, 'c')).toThrow(/CHECK constraint failed/);
    expect(() =>
      cliente
        .prepare(`INSERT INTO asiento (id, transaccion_id, cuenta_id, monto) VALUES ('z', ?, ?, 0)`)
        .run(tx.id, C.efectivo),
    ).toThrow(/CHECK constraint failed/);
  });

  it('la vista transaccion_vigente excluye anuladas y reversas', () => {
    const { cliente, libro, tx } = conGasto();
    const vigentes = () =>
      (cliente.prepare('SELECT id FROM transaccion_vigente').all() as { id: string }[]).map((f) => f.id);
    expect(vigentes()).toEqual([tx.id]);
    libro.anular(tx.id);
    expect(vigentes()).toEqual([]);
  });
});
