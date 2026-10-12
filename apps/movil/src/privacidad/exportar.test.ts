import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { abrirBaseCifrada } from '../db/abrir';
import { CLAVE_LLAVE_BASE } from '../db/llave';
import { aleatorioNode, puertoNode } from '../db/node';
import { obtenerBloqueo, fijarBloqueo, onboardingCompletado } from '../servicios/ajustes';
import { crearContexto } from '../servicios/contexto';
import { anularMovimiento, registrarMovimiento } from '../servicios/formulario';
import { crearGeneradorSecuencial } from '../servicios/ids';
import { registrarTexto } from '../servicios/registrar';
import { relojFijo } from '../servicios/reloj';
import { cargarEscenario } from '../servicios/semilla';
import { abrirPrueba, escenario } from '../servicios/__pruebas__/base';
import { borrarTodo } from './borrar';
import { obtenerConsentimiento } from './consentimiento';
import { COLUMNAS_CSV, exportarCsv, exportarJson, TABLAS_EXPORTADAS } from './exportar';

const carpetas: string[] = [];
afterEach(() => {
  for (const c of carpetas.splice(0)) rmSync(c, { recursive: true, force: true });
});

describe('exportar y borrar todo', () => {
  it('CA-M2-04 · exportar genera JSON completo y CSV de movimientos', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    const r = registrarTexto(p.ctx, 'coca 25 en efectivo');
    const r2 = registrarTexto(p.ctx, 'tacos, "al pastor" 80 con la nu');
    expect(r2.resultado).toBe('por_interpretar');
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    const anulado = registrarTexto(p.ctx, 'café 40 en efectivo');
    if (anulado.resultado !== 'registrado') throw new Error(anulado.resultado);
    anularMovimiento(p.ctx, anulado.deshacer);

    const json = JSON.parse(exportarJson(p.ctx)) as {
      formato: string;
      montos: string;
      tablas: Record<string, Record<string, unknown>[]>;
    };
    expect(json.formato).toBe('finanvoz-exportacion');
    expect(json.montos).toBe('centavos');
    // Todas las tablas de la base, completas.
    const tablas = p.ctx.db
      .all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 2) <> '__' ORDER BY name`,
      )
      .map((t) => t.name);
    expect([...TABLAS_EXPORTADAS].sort()).toEqual(tablas);
    expect(json.tablas.transaccion).toHaveLength(
      Number(p.ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM transaccion`)?.n),
    );
    expect(json.tablas.cuenta?.find((c) => c.id === e.cuentas.efectivo)).toMatchObject({ nombre: 'Cartera' });
    expect(json.tablas.ajuste?.some((a) => a.clave === 'consentimiento')).toBe(true);

    const csv = exportarCsv(p.ctx).split('\r\n');
    expect(csv[0]).toBe(COLUMNAS_CSV.join(','));
    const filas = csv.slice(1).filter((f) => f !== '');
    // Solo el gasto vigente: los saldos iniciales no son movimientos y el anulado no aparece.
    expect(filas).toEqual([`2026-10-11,gasto,coca,,Antojos,25.00,salida,Cartera,,texto,0,0,${r.deshacer}`]);
  });

  it('el CSV escapa comas y comillas (RFC 4180)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_005,
      categoria: 'comida_fuera',
      origenId: e.cuentas.efectivo as string,
      descripcion: 'tacos, "al pastor"',
    });
    const [, fila] = exportarCsv(p.ctx).split('\r\n');
    expect(fila).toMatch(
      /^2026-10-11,gasto,"tacos, ""al pastor""",,Comida fuera,80\.05,salida,Cartera,,manual,0,0,/,
    );
  });

  it('CA-M2-04 · borrar todo destruye la llave y el archivo: la app queda como recién instalada', async () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'cartera-'));
    carpetas.push(carpeta);
    const archivo = join(carpeta, 'cartera.db');
    const puerto = puertoNode(archivo);
    const p = abrirPrueba('2026-10-11', archivo);
    cargarEscenario(p.ctx, escenario('e4-01'));
    fijarBloqueo(p.ctx, { activo: true, ocultarEnMultitarea: true });
    const llave = p.almacen.obtener(CLAVE_LLAVE_BASE);
    expect(llave).not.toBeNull();
    expect(existsSync(archivo)).toBe(true);

    await borrarTodo({ base: p.base, puerto, almacen: p.almacen });
    expect(p.almacen.obtener(CLAVE_LLAVE_BASE)).toBeNull();
    expect(existsSync(archivo)).toBe(false);

    // Siguiente arranque: llave nueva, base vacía, sin consentimiento ni preferencias.
    const base = abrirBaseCifrada({ puerto, almacen: p.almacen, aleatorio: aleatorioNode });
    const ctx = crearContexto({
      db: base.db,
      reloj: relojFijo('2026-10-11'),
      generarId: crearGeneradorSecuencial(),
    });
    expect(p.almacen.obtener(CLAVE_LLAVE_BASE)).not.toBe(llave);
    expect(obtenerConsentimiento(ctx)).toBeNull();
    expect(onboardingCompletado(ctx)).toBe(false);
    expect(obtenerBloqueo(ctx).activo).toBe(false);
    expect(ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM transaccion`)?.n).toBe(0);
    expect(ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM ajuste`)?.n).toBe(0);
    expect(
      ctx.db.get<{ n: number }>(
        sql`SELECT count(*) AS n FROM cuenta WHERE sistema = 0 AND naturaleza NOT IN ('gasto','ingreso')`,
      )?.n,
    ).toBe(0);
    base.cerrar();
  });
});
