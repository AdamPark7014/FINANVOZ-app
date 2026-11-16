// RLS y reglas del admin ERP con la migración real en PGlite.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

const migracion = readFileSync(
  new URL('../../../migrations/20261401000000_admin_erp.sql', import.meta.url),
  'utf8',
);

const DUENO = '00000000-0000-4000-8000-000000000001';
const VEND_A = '00000000-0000-4000-8000-000000000002';
const VEND_B = '00000000-0000-4000-8000-000000000003';
const AJENO = '00000000-0000-4000-8000-000000000004';

let db: PGlite;
let n = 0;

async function como<T>(usuario: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  if (usuario === null) {
    await db.exec('set role anon;');
  } else if (usuario === 'service') {
    await db.exec('set role service_role; reset request.jwt.claim.sub;');
  } else {
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${usuario}';`);
  }
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role; reset request.jwt.claim.sub;');
  }
}

async function abrir(): Promise<void> {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    alter role service_role bypassrls;
    create schema auth;
    grant usage on schema auth to authenticated, anon, service_role;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to authenticated, anon, service_role;
    insert into auth.users values ('${DUENO}'), ('${VEND_A}'), ('${VEND_B}'), ('${AJENO}');
  `);
  await db.exec(migracion);
  await como(
    'service',
    `insert into admin_miembros (usuario_id, nombre, rol) values
    ('${DUENO}', 'Adam', 'dueno'),
    ('${VEND_A}', 'Vendedora A', 'vendedor'),
    ('${VEND_B}', 'Vendedor B', 'vendedor')`,
  );
}

beforeEach(async () => {
  await abrir();
  n = 0;
});

async function cliente(vendedor: string, nombre = 'Cliente'): Promise<string> {
  n += 1;
  const id = `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  await como(
    vendedor,
    `insert into admin_clientes (id, nombre, tipo, vendedor_id) values ($1, $2, 'negocio', $3)`,
    [id, `${nombre} ${n}`, vendedor],
  );
  return id;
}

describe('RLS admin ERP', () => {
  it('dueño ve todo; vendedor A no ve lo de B; anon nada; sin rol nada', async () => {
    const ca = await cliente(VEND_A, 'De A');
    const cb = await cliente(VEND_B, 'De B');
    await como(
      VEND_A,
      `insert into admin_prospectos (nombre, origen, interes, vendedor_id) values ('Pa', 'pagina', 'plus', $1)`,
      [VEND_A],
    );
    await como(
      VEND_B,
      `insert into admin_prospectos (nombre, origen, interes, vendedor_id) values ('Pb', 'pagina', 'plus', $1)`,
      [VEND_B],
    );

    expect(
      (await como<{ id: string }>(DUENO, 'select id from admin_clientes order by nombre')).map((r) => r.id),
    ).toEqual([ca, cb].sort());
    expect(await como<{ nombre: string }>(VEND_A, 'select nombre from admin_clientes')).toEqual([
      expect.objectContaining({ nombre: expect.stringContaining('De A') }),
    ]);
    expect(await como(VEND_A, 'select nombre from admin_clientes where id = $1', [cb])).toEqual([]);
    expect(await como<{ nombre: string }>(VEND_A, 'select nombre from admin_prospectos')).toEqual([
      { nombre: 'Pa' },
    ]);
    expect(await como(AJENO, 'select * from admin_clientes')).toEqual([]);
    await expect(como(null, 'select * from admin_clientes')).rejects.toThrow(
      /permission denied|row-level security/i,
    );
  });

  it('vendedor no marca pagada ni reasigna; dueño sí cobra', async () => {
    const c = await cliente(VEND_A);
    const filas = await como<{ id: string; folio: string; estado: string }>(
      VEND_A,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos)
       values ($1, $2, 'plus_mensual', 1, 1, 9900) returning id, folio, estado`,
      [c, VEND_A],
    );
    const venta = filas[0];
    if (!venta) throw new Error('sin venta');
    expect(venta.estado).toBe('por_cobrar');

    await expect(
      como(VEND_A, `update admin_ventas set estado = 'pagada', pagada_en = now() where id = $1`, [venta.id]),
    ).rejects.toThrow(/vendedor_no_cobra/);

    await expect(
      como(VEND_A, `update admin_ventas set vendedor_id = $1 where id = $2`, [VEND_B, venta.id]),
    ).rejects.toThrow(/vendedor_no_reasigna|row-level security/i);

    await como(DUENO, `update admin_ventas set estado = 'pagada', pagada_en = now() where id = $1`, [
      venta.id,
    ]);
    expect(
      await como<{ estado: string }>(DUENO, 'select estado from admin_ventas where id = $1', [venta.id]),
    ).toEqual([{ estado: 'pagada' }]);
  });

  it('folios consecutivos, total calculado y precio por omisión', async () => {
    const c = await cliente(VEND_A);
    const a = await como<{ folio: string; total_centavos: string }>(
      VEND_A,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos)
       values ($1, $2, 'licencias', 2, 3, 2000) returning folio, total_centavos`,
      [c, VEND_A],
    );
    const b = await como<{ folio: string; precio_unitario_centavos: string; total_centavos: string }>(
      VEND_A,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses)
       values ($1, $2, 'plus_mensual', 1, 1) returning folio, precio_unitario_centavos, total_centavos`,
      [c, VEND_A],
    );
    expect(a[0]?.folio).toBe('FV-0001');
    expect(b[0]?.folio).toBe('FV-0002');
    expect(Number(a[0]?.total_centavos)).toBe(2 * 3 * 2000);
    expect(Number(b[0]?.precio_unitario_centavos)).toBe(9900);
    expect(Number(b[0]?.total_centavos)).toBe(9900);
  });

  it('bitácora se escribe y solo el dueño la lee', async () => {
    await cliente(VEND_A);
    const bits = await como<{ accion: string; tabla: string }>(
      DUENO,
      `select accion, tabla from admin_bitacora where tabla = 'admin_clientes' order by id`,
    );
    expect(bits.some((b) => b.accion === 'insert')).toBe(true);
    expect(await como(VEND_A, 'select id from admin_bitacora')).toEqual([]);
  });

  it('comisión del mes usa pct del miembro o el general', async () => {
    const c = await cliente(VEND_A);
    await como(
      VEND_A,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos)
       values ($1, $2, 'plus_mensual', 1, 1, 10000)`,
      [c, VEND_A],
    );
    await como(DUENO, `update admin_ventas set estado = 'pagada', pagada_en = now()`);
    const com = await como<{ cobrado_centavos: string; comision_centavos: string }>(
      DUENO,
      `select cobrado_centavos, comision_centavos from admin_comisiones_mes where vendedor_id = $1`,
      [VEND_A],
    );
    expect(Number(com[0]?.cobrado_centavos)).toBe(10000);
    // 15 % general = 1500 pb → 1500 centavos
    expect(Number(com[0]?.comision_centavos)).toBe(1500);

    await como('service', `update admin_miembros set comision_pb = 2000 where usuario_id = $1`, [VEND_A]);
    const com2 = await como<{ comision_centavos: string }>(
      DUENO,
      `select comision_centavos from admin_comisiones_mes where vendedor_id = $1`,
      [VEND_A],
    );
    expect(Number(com2[0]?.comision_centavos)).toBe(2000);
  });

  it('admin_resumen respeta el rol', async () => {
    const ca = await cliente(VEND_A);
    const cb = await cliente(VEND_B);
    await como(
      VEND_A,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos)
       values ($1, $2, 'plus_mensual', 1, 1, 5000)`,
      [ca, VEND_A],
    );
    await como(
      VEND_B,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos)
       values ($1, $2, 'plus_mensual', 1, 1, 7000)`,
      [cb, VEND_B],
    );
    await como(DUENO, `update admin_ventas set estado = 'pagada', pagada_en = now()`);

    const mes = new Date().toISOString().slice(0, 10);
    const rDueno = await como<{ r: Record<string, unknown> }>(DUENO, `select admin_resumen($1::date) as r`, [
      mes,
    ]);
    const rA = await como<{ r: Record<string, unknown> }>(VEND_A, `select admin_resumen($1::date) as r`, [
      mes,
    ]);
    expect(Number(rDueno[0]?.r['ingreso_cobrado_centavos'])).toBe(12000);
    expect(Number(rA[0]?.r['ingreso_cobrado_centavos'])).toBe(5000);
    expect(await como(AJENO, `select admin_resumen($1::date) as r`, [mes])).toEqual([{ r: null }]);
  });

  it('reparto por turno y límite por IP', async () => {
    // A más antiguo → primero; luego B; luego el que tenga menos abiertos.
    await como('service', `select admin_registrar_prospecto('h1', 'Uno', '', '', 'a@x.mx', 'plus', '', 5)`);
    await como('service', `select admin_registrar_prospecto('h2', 'Dos', '', '', 'b@x.mx', 'plus', '', 5)`);
    const asignados = await como<{ nombre: string; vendedor_id: string }>(
      DUENO,
      `select nombre, vendedor_id from admin_prospectos order by nombre`,
    );
    expect(asignados).toEqual([
      { nombre: 'Dos', vendedor_id: VEND_B },
      { nombre: 'Uno', vendedor_id: VEND_A },
    ]);

    for (let i = 0; i < 5; i++) {
      const r = await como<{ r: string }>(
        'service',
        `select admin_registrar_prospecto('misma', $1, '', '', '', 'otro', '', 5) as r`,
        [`N${i}`],
      );
      expect(r[0]?.r).toBe('ok');
    }
    const lim = await como<{ r: string }>(
      'service',
      `select admin_registrar_prospecto('misma', 'Extra', '', '', '', 'otro', '', 5) as r`,
    );
    expect(lim[0]?.r).toBe('limite');
  });

  it('vendedor no borra; parámetros solo dueño escribe', async () => {
    const c = await cliente(VEND_A);
    await expect(como(VEND_A, 'delete from admin_clientes where id = $1', [c])).rejects.toThrow(
      /permission denied/,
    );
    // RLS: el UPDATE del vendedor no toca filas (PostgREST devolvería 0).
    await como(VEND_A, `update admin_parametros set valor = '1' where clave = 'iva_pct'`);
    expect(
      await como<{ valor: unknown }>(VEND_A, `select valor from admin_parametros where clave = 'iva_pct'`),
    ).toEqual([{ valor: 1600 }]);
    await como(DUENO, `update admin_parametros set valor = '1600' where clave = 'iva_pct'`);
    expect(
      await como<{ valor: unknown }>(DUENO, `select valor from admin_parametros where clave = 'iva_pct'`),
    ).toEqual([{ valor: 1600 }]);
  });

  const insertarVenta = (usuario: string, clienteId: string, vendedor: string, extra = '', valores = '') =>
    como<{ id: string }>(
      usuario,
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses${extra})
       values ($1, $2, 'plus_mensual', 1, 1${valores}) returning id`,
      [clienteId, vendedor],
    );

  it('vendedor no registra una venta ya pagada ni con cliente de otro vendedor', async () => {
    const ca = await cliente(VEND_A);
    const cb = await cliente(VEND_B);
    await expect(insertarVenta(VEND_A, ca, VEND_A, ', estado', `, 'pagada'`)).rejects.toThrow(
      /vendedor_no_cobra/,
    );
    await expect(insertarVenta(VEND_A, ca, VEND_A, ', pagada_en', ', now()')).rejects.toThrow(
      /vendedor_no_cobra/,
    );
    await expect(insertarVenta(VEND_A, cb, VEND_A)).rejects.toThrow(/cliente_de_otro_vendedor/);
    await expect(
      como(
        VEND_A,
        `insert into admin_prospectos (nombre, origen, interes, vendedor_id, cliente_id)
         values ('P', 'llamada', 'plus', $1, $2)`,
        [VEND_A, cb],
      ),
    ).rejects.toThrow(/cliente_de_otro_vendedor/);
  });

  it('una venta cobrada queda cerrada para el vendedor; el folio no cambia', async () => {
    const ca = await cliente(VEND_A);
    const [v] = await insertarVenta(VEND_A, ca, VEND_A);
    if (!v) throw new Error('sin venta');
    await como(VEND_A, `update admin_ventas set folio = 'FV-9999', cantidad = 2 where id = $1`, [v.id]);
    expect(
      await como<{ folio: string; cantidad: number }>(
        DUENO,
        'select folio, cantidad from admin_ventas where id = $1',
        [v.id],
      ),
    ).toEqual([{ folio: 'FV-0001', cantidad: 2 }]);

    await como(DUENO, `update admin_ventas set estado = 'pagada' where id = $1`, [v.id]);
    const [pagada] = await como<{ pagada: boolean }>(
      DUENO,
      'select pagada_en is not null as pagada from admin_ventas where id = $1',
      [v.id],
    );
    expect(pagada?.pagada).toBe(true);
    await expect(como(VEND_A, `update admin_ventas set cantidad = 5 where id = $1`, [v.id])).rejects.toThrow(
      /venta_cerrada/,
    );
  });

  it('convertir un prospecto crea el cliente en un paso y solo para sus prospectos', async () => {
    const [pa] = await como<{ id: string }>(
      VEND_A,
      `insert into admin_prospectos (nombre, origen, interes, vendedor_id, correo)
       values ('Caja Popular San Andrés', 'llamada', 'licencias', $1, 'caja@x.mx') returning id`,
      [VEND_A],
    );
    if (!pa) throw new Error('sin prospecto');
    await expect(como(VEND_B, 'select admin_convertir_prospecto($1)', [pa.id])).rejects.toThrow(
      /prospecto_no_encontrado/,
    );
    const [r] = await como<{ r: { cliente: { id: string; tipo: string }; prospecto: { etapa: string } } }>(
      VEND_A,
      'select admin_convertir_prospecto($1) as r',
      [pa.id],
    );
    expect(r?.r.prospecto.etapa).toBe('ganado');
    expect(r?.r.cliente.tipo).toBe('negocio');
    // Repetirlo no duplica el cliente.
    await como(VEND_A, 'select admin_convertir_prospecto($1)', [pa.id]);
    expect(await como(DUENO, 'select id from admin_clientes')).toHaveLength(1);
  });

  it('cancelar exige motivo', async () => {
    const ca = await cliente(VEND_A);
    const [v] = await insertarVenta(VEND_A, ca, VEND_A);
    if (!v) throw new Error('sin venta');
    await expect(
      como(DUENO, `update admin_ventas set estado = 'cancelada' where id = $1`, [v.id]),
    ).rejects.toThrow(/falta_motivo/);
    await como(
      DUENO,
      `update admin_ventas set estado = 'cancelada', cancelada_motivo = 'Se arrepintió' where id = $1`,
      [v.id],
    );
  });

  it('el cobro cuenta en el mes en que se cobra y el vendedor no ve cifras de toda la app', async () => {
    const ca = await cliente(VEND_A);
    // Registrada en octubre (el creado_en no cambia después: se fija al insertar), cobrada en noviembre.
    const [v] = await como<{ id: string }>(
      'service',
      `insert into admin_ventas (cliente_id, vendedor_id, producto, cantidad, meses, precio_unitario_centavos,
         creado_en, creado_por)
       values ($1, $2, 'plus_mensual', 1, 1, 10000, '2026-10-20T18:00:00Z', $2) returning id`,
      [ca, VEND_A],
    );
    if (!v) throw new Error('sin venta');
    await como(
      DUENO,
      `update admin_ventas set estado = 'pagada', pagada_en = '2026-11-05T18:00:00Z' where id = $1`,
      [v.id],
    );
    const filas = await como<{ mes: string; vendido_centavos: string; cobrado_centavos: string }>(
      DUENO,
      `select to_char(mes, 'YYYY-MM-DD') as mes, vendido_centavos, cobrado_centavos
       from admin_comisiones_mes order by mes`,
    );
    expect(filas.map((f) => [f.mes, Number(f.vendido_centavos), Number(f.cobrado_centavos)])).toEqual([
      ['2026-10-01', 10000, 0],
      ['2026-11-01', 0, 10000],
    ]);

    const [rA] = await como<{ r: Record<string, unknown> }>(
      VEND_A,
      `select admin_resumen('2026-11-01') as r`,
    );
    expect(rA?.r['plus_activos']).toBe(0);
    expect(rA?.r['usuarios_activos_7d']).toBe(0);
  });
});
