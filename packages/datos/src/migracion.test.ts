import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { ErrorDominio } from '@cartera/core';
import { abrirBase, C, migrar } from './__pruebas__/base';
import { TABLAS_0001, TABLAS_0002, TABLAS_0003, TABLAS_0004, TABLAS_0005 } from './esquema';
import {
  CATEGORIAS_GASTO_FIJO,
  CATEGORIAS_GASTO_VARIABLE,
  CATEGORIAS_INGRESO,
  CUENTAS_SISTEMA,
  idCategoria,
} from './semillas';
import { construirGasto } from '@cartera/core';

const TODAS = { ...TABLAS_0001, ...TABLAS_0002, ...TABLAS_0003, ...TABLAS_0004, ...TABLAS_0005 };
const TABLAS = Object.keys(TODAS).sort();

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
      'evento_compartido_inmutable_d',
      'evento_compartido_inmutable_u',
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
    for (const [nombre, tabla] of Object.entries(TODAS)) {
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

describe('M8 · migración 0002_tandas', () => {
  function conTanda() {
    const base = abrirBase();
    base.cliente
      .prepare(
        `INSERT INTO programado (id, tipo, concepto, monto, regla, desde, hasta)
         VALUES ('p1', 'egreso', 'Tanda', 50000, '{"tipo":"semanal","dia_semana":5}', '2026-10-16', '2026-12-18')`,
      )
      .run();
    const insertar = (
      id: string,
      extra: { participantes?: number; turno?: number; aportacion?: number } = {},
    ) =>
      base.cliente
        .prepare(
          `INSERT INTO tanda (id, cuenta_id, nombre, aportacion, participantes, turno, regla, inicio, programado_id)
           VALUES (?, ?, 'Tanda', ?, ?, ?, '{"tipo":"semanal","dia_semana":5}', '2026-10-16', 'p1')`,
        )
        .run(id, C.tanda, extra.aportacion ?? 50000, extra.participantes ?? 10, extra.turno ?? 4);
    return { ...base, insertar };
  }

  it('crea la tabla tanda con su cuenta y su programado; activa por omisión', () => {
    const { cliente, insertar } = conTanda();
    insertar('t1');
    expect(cliente.prepare('SELECT activa FROM tanda WHERE id = ?').get('t1')).toEqual({ activa: 1 });
  });

  it('CHECK: aportación > 0, 2–50 participantes y turno dentro de los participantes', () => {
    const { insertar } = conTanda();
    expect(() => insertar('a', { aportacion: 0 })).toThrow(/CHECK constraint failed/);
    expect(() => insertar('b', { participantes: 1, turno: 1 })).toThrow(/CHECK constraint failed/);
    expect(() => insertar('c', { participantes: 51 })).toThrow(/CHECK constraint failed/);
    expect(() => insertar('d', { participantes: 5, turno: 6 })).toThrow(/CHECK constraint failed/);
    expect(() => insertar('e', { turno: 0 })).toThrow(/CHECK constraint failed/);
  });

  it('una cuenta y un programado pertenecen a una sola tanda', () => {
    const { insertar } = conTanda();
    insertar('t1');
    expect(() => insertar('t2')).toThrow(/UNIQUE constraint failed/);
  });
});

describe('M12 · migración 0004_cfdi', () => {
  const insertar = (
    cliente: ReturnType<typeof abrirBase>['cliente'],
    uuid: string,
    extra: { fecha?: string; total?: number; estatus?: string; transaccion?: string | null } = {},
  ) =>
    cliente
      .prepare(
        `INSERT INTO cfdi (uuid, xml, emisor_rfc, receptor_rfc, fecha, tipo_comprobante, total, iva, estatus,
                           transaccion_id, importado_en)
         VALUES (?, '<x/>', 'AAA010101AAA', 'PEPJ800101AB1', ?, 'I', ?, 0, ?, ?, 0)`,
      )
      .run(
        uuid,
        extra.fecha ?? '2026-03-14',
        extra.total ?? 150000,
        extra.estatus ?? 'desconocido',
        extra.transaccion ?? null,
      );

  it('crea la tabla cfdi con estatus desconocido y etiquetas vacías por omisión', () => {
    const { cliente } = abrirBase();
    insertar(cliente, '5A1B2C3D-0000-4000-8000-000000000001');
    expect(cliente.prepare('SELECT estatus, etiquetas FROM cfdi').get()).toEqual({
      estatus: 'desconocido',
      etiquetas: '{}',
    });
  });

  it('el UUID es la llave y va en mayúsculas: la misma factura no entra dos veces', () => {
    const { cliente } = abrirBase();
    insertar(cliente, '5A1B2C3D-0000-4000-8000-000000000001');
    expect(() => insertar(cliente, '5A1B2C3D-0000-4000-8000-000000000001')).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() => insertar(cliente, '5a1b2c3d-0000-4000-8000-000000000009')).toThrow(
      /CHECK constraint failed/,
    );
  });

  it('CHECK: estatus, fecha civil, montos no negativos y transacción existente', () => {
    const { cliente } = abrirBase();
    expect(() => insertar(cliente, 'A', { estatus: 'pagado' })).toThrow(/CHECK constraint failed/);
    expect(() => insertar(cliente, 'B', { fecha: '2026-3-1' })).toThrow(/CHECK constraint failed/);
    expect(() => insertar(cliente, 'C', { total: -1 })).toThrow(/CHECK constraint failed/);
    expect(() => insertar(cliente, 'D', { transaccion: 'no-existe' })).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});

describe('M16 · migración 0005_compartido', () => {
  const GRUPO = '7f3c1a52-8d4e-4b6a-9c21-0e5f7a8b9c0d';
  const EVENTO = '3b9f6c2e-1a7d-4e58-b4c3-9d2a6f1e8b70';

  function conGrupo(extra: { miAutor?: string; nombre?: string; contraparte?: string } = {}) {
    const base = abrirBase();
    base.cliente
      .prepare(
        `INSERT INTO grupo_compartido (id, nombre, contraparte_id, mi_autor, creado_en) VALUES (?, ?, ?, ?, 0)`,
      )
      .run(GRUPO, extra.nombre ?? 'Ana', extra.contraparte ?? C.ana, extra.miAutor ?? 'b');
    return base;
  }

  const insertarEvento = (
    cliente: ReturnType<typeof abrirBase>['cliente'],
    id = EVENTO,
    extra: { autor?: string; tipo?: string; grupo?: string; transaccion?: string | null } = {},
  ) =>
    cliente
      .prepare(
        `INSERT INTO evento_compartido (id, grupo_id, autor, creado_en, tipo, cuerpo, transaccion_id)
         VALUES (?, ?, ?, 1, ?, '{}', ?)`,
      )
      .run(
        id,
        extra.grupo ?? GRUPO,
        extra.autor ?? 'a',
        extra.tipo ?? 'gasto_compartido_creado',
        extra.transaccion ?? null,
      );

  it('crea las tablas del grupo y de sus eventos; un evento nuevo queda pendiente de publicar', () => {
    const { cliente } = conGrupo();
    insertarEvento(cliente);
    expect(cliente.prepare('SELECT mi_autor, cerrado_en FROM grupo_compartido').get()).toEqual({
      mi_autor: 'b',
      cerrado_en: null,
    });
    expect(cliente.prepare('SELECT recibido_en, transaccion_id FROM evento_compartido').get()).toEqual({
      recibido_en: null,
      transaccion_id: null,
    });
  });

  it('CHECK: lugar a o b, tipo de evento conocido, nombre no vacío y una contraparte por grupo', () => {
    expect(() => conGrupo({ miAutor: 'c' })).toThrow(/CHECK constraint failed/);
    expect(() => conGrupo({ nombre: '' })).toThrow(/CHECK constraint failed/);
    expect(() => conGrupo({ contraparte: 'no-existe' })).toThrow(/FOREIGN KEY constraint failed/);
    const { cliente } = conGrupo();
    expect(() =>
      cliente
        .prepare(
          `INSERT INTO grupo_compartido (id, nombre, contraparte_id, mi_autor, creado_en) VALUES ('g2', 'x', ?, 'a', 0)`,
        )
        .run(C.ana),
    ).toThrow(/UNIQUE constraint failed/);
    expect(() => insertarEvento(cliente, 'e1', { autor: 'c' })).toThrow(/CHECK constraint failed/);
    expect(() => insertarEvento(cliente, 'e2', { tipo: 'gasto' })).toThrow(/CHECK constraint failed/);
    expect(() => insertarEvento(cliente, 'e3', { grupo: 'otro' })).toThrow(/FOREIGN KEY constraint failed/);
    expect(() => insertarEvento(cliente, 'e4', { transaccion: 'no-existe' })).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    insertarEvento(cliente, 'e5');
    expect(() => insertarEvento(cliente, 'e5')).toThrow(/UNIQUE constraint failed/);
  });

  it('un evento es inmutable: solo se completan transaccion_id y recibido_en; no se borra', () => {
    const { cliente } = conGrupo();
    insertarEvento(cliente);
    for (const cambio of [
      `autor = 'b'`,
      `tipo = 'evento_anulado'`,
      `cuerpo = '{"x":1}'`,
      'creado_en = 2',
      `grupo_id = 'x'`,
      `id = 'x'`,
    ]) {
      expect(() => cliente.prepare(`UPDATE evento_compartido SET ${cambio}`).run(), cambio).toThrow(
        /evento_compartido_inmutable/,
      );
    }
    expect(() => cliente.prepare('DELETE FROM evento_compartido').run()).toThrow(
      /evento_compartido_inmutable/,
    );
    cliente.prepare(`UPDATE evento_compartido SET recibido_en = '2026-10-12T15:30:00.000001Z'`).run();
    expect(cliente.prepare('SELECT recibido_en FROM evento_compartido').get()).toEqual({
      recibido_en: '2026-10-12T15:30:00.000001Z',
    });
  });
});
