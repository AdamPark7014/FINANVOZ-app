import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ErrorDominio, construirGasto, construirIngreso, sumarDias } from '@cartera/core';
import { comprobarIntegridad } from '@cartera/datos';
import { escribirRespaldo, leerEncabezado } from '@cartera/respaldo';
import { criptoNode } from '@cartera/respaldo/node';
import { almacenEnMemoria } from '../db/llave';
import { MIGRACIONES } from '../db/migraciones.generado';
import { aleatorioNode, puertoNode } from '../db/node';
import { LLAVES_ALMACEN, borrarTodo } from '../privacidad/borrar';
import { TABLAS_EXPORTADAS, datosExportacion } from '../privacidad/exportar';
import { CLAVE_LLAVE_RESPALDO, leerLlaveRespaldo } from '../respaldo/llave';
import { crearContexto, type Contexto } from './contexto';
import { obtenerHoy } from './hoy';
import { crearGeneradorSecuencial } from './ids';
import {
  MENSAJE_NO_ABRE,
  fechaRespaldo,
  fijarContrasenaRespaldo,
  generarRespaldo,
  mensajeErrorRespaldo,
  mensajeRestaurado,
  prepararRestauracion,
  restaurarRespaldo,
  resumenRespaldo,
  tieneContrasenaRespaldo,
  validarContrasenaNueva,
  type DependenciasRespaldo,
} from './respaldo';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

const CONTRASENA = 'mi respaldo seguro 2026';

/** Dependencias de Node: `node:crypto`, almacén en memoria y bases better-sqlite3 en memoria. */
function dependencias(almacen = almacenEnMemoria()): DependenciasRespaldo & {
  almacen: ReturnType<typeof almacenEnMemoria>;
} {
  return {
    cripto: criptoNode,
    almacen,
    aleatorio: aleatorioNode,
    puertoBase: puertoNode(),
    puertoEnsayo: () => puertoNode(),
  };
}

async function codigoDe(promesa: Promise<unknown> | (() => unknown)): Promise<string> {
  try {
    await (typeof promesa === 'function' ? promesa() : promesa);
  } catch (e) {
    if (e instanceof ErrorDominio) return e.codigo;
    throw e;
  }
  throw new Error('se esperaba un error');
}

/** Saldo de cada cuenta (Σ de todos sus asientos, E2.3). */
function saldos(ctx: Pick<Contexto, 'db'>) {
  return ctx.db.all<{ cuenta_id: string; saldo: number }>(
    sql`SELECT cuenta_id, SUM(monto) AS saldo FROM asiento GROUP BY cuenta_id ORDER BY cuenta_id`,
  );
}

/** Todas las filas de todas las tablas (estado idéntico). */
function contenido(ctx: Pick<Contexto, 'db'>) {
  return Object.fromEntries(
    TABLAS_EXPORTADAS.map((t) => [t, ctx.db.all(sql.raw(`SELECT * FROM "${t}" ORDER BY rowid`))]),
  );
}

/**
 * `n` asientos generados (n/2 transacciones de 2 asientos) sobre las cuentas de la semilla, en los 400 días
 * anteriores a `hoy`, alternando gastos e ingresos de pocos centavos para que el libro siga sano.
 */
function generarAsientos(ctx: Contexto, cuentaId: string, n: number): void {
  ctx.db.transaction(() => {
    for (let i = 0; i < n / 2; i++) {
      const monto = 1 + (i % 97);
      const mov =
        i % 2 === 0
          ? construirGasto({ categoria: 'cat:personal:super', pago: cuentaId, monto })
          : construirIngreso({ destino: cuentaId, categoria: 'cat:personal:ventas', monto });
      ctx.libro.registrar({
        ...mov,
        fecha: sumarDias(ctx.reloj.hoy(), -1 - (i % 400)),
        origen: 'manual',
        claveIdempotencia: `generado:${i}`,
        // Comillas, acentos y emoji: el texto debe volver idéntico.
        descripcion: i % 1000 === 0 ? `Taquería O'Higgins "centro" 🌮 ${i}` : `movimiento ${i}`,
      });
    }
  });
}

describe('respaldo cifrado (M9)', () => {
  it('CA-M9-02 · e4-01 + 50,000 asientos → exportar → importar en una instalación limpia: mismo estado en < 30 s', async () => {
    const p = abrirPrueba('2026-10-11');
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    generarAsientos(p.ctx, e.cuentas.bbva ?? '', 50_000);
    const asientos = Number(p.ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM asiento`)?.n);
    expect(asientos).toBeGreaterThanOrEqual(50_000);
    const antes = { saldos: saldos(p.ctx), hoy: obtenerHoy(p.ctx), filas: contenido(p.ctx) };

    const origen = dependencias();
    await fijarContrasenaRespaldo(origen, CONTRASENA, CONTRASENA);
    const t0 = performance.now();
    const archivo = await generarRespaldo(origen, p.ctx);
    const tExportar = performance.now() - t0;

    // Teléfono nuevo: almacén vacío, base nueva.
    const destino = dependencias();
    const t1 = performance.now();
    const listo = await prepararRestauracion(destino, archivo, CONTRASENA);
    const base = restaurarRespaldo(destino, listo);
    const tImportar = performance.now() - t1;
    const ctx = crearContexto({ db: base.db, reloj: p.reloj, generarId: crearGeneradorSecuencial() });

    expect(saldos(ctx)).toEqual(antes.saldos);
    expect(obtenerHoy(ctx)).toEqual(antes.hoy);
    expect(obtenerHoy(ctx).hoyPuedesPesos).toBe(antes.hoy.hoyPuedesPesos);
    expect(comprobarIntegridad(ctx.db)).toEqual([]);
    expect(contenido(ctx)).toEqual(antes.filas);
    expect(listo.movimientos).toBe(
      Number(p.ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM transaccion_vigente`)?.n),
    );
    // La llave del respaldo queda en el teléfono nuevo: el automático sigue sin pedir la contraseña.
    expect(tieneContrasenaRespaldo(destino)).toBe(true);
    expect(tExportar + tImportar).toBeLessThan(30_000);
    // Solo tiempos y tamaño, nunca datos (regla 9). Se registran en docs/ESTADO.md.
    console.info(
      `CA-M9-02: ${asientos} asientos, ${archivo.length} bytes; exportar ${Math.round(tExportar)} ms, importar ${Math.round(tImportar)} ms`,
    );
    base.cerrar();
    p.base.cerrar();
  }, 120_000);

  it('el archivo no lleva montos, nombres ni comercios legibles; el encabezado dice la fecha sin contraseña', async () => {
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    const deps = dependencias();
    await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
    const archivo = await generarRespaldo(deps, p.ctx);
    const texto = Buffer.from(archivo).toString('latin1');
    for (const legible of ['Cartera', 'BBVA', '5521', 'renta', '359000', 'quincena']) {
      expect(texto).not.toContain(legible);
    }
    expect(fechaRespaldo(archivo)).toBe(new Date(p.reloj.ahora()).toISOString().replace(/\.\d{3}Z$/, 'Z'));
    expect(leerEncabezado(archivo).encabezado).toMatchObject({
      kdf: { n: 2 ** 17, r: 8, p: 1 },
      version_esquema: MIGRACIONES.length,
    });
    p.base.cerrar();
  }, 30_000);

  it('CA-M9-08 · la llave queda en el almacén seguro; cambiar la contraseña genera sal y llave nuevas y el respaldo viejo abre con la vieja', async () => {
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    const deps = dependencias();
    expect(tieneContrasenaRespaldo(deps)).toBe(false);
    expect(await codigoDe(generarRespaldo(deps, p.ctx))).toBe('respaldo_sin_contrasena');

    await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
    const guardada = deps.almacen.valores.get(CLAVE_LLAVE_RESPALDO) ?? '';
    // Solo la llave derivada y la sal; la contraseña nunca se guarda.
    expect(guardada).not.toContain(CONTRASENA);
    expect(JSON.parse(guardada)).toMatchObject({ v: 1, n: 2 ** 17, r: 8, p: 1 });
    const llaveVieja = leerLlaveRespaldo(deps.almacen);
    // Respaldo "automático": sin contraseña, con la llave guardada.
    const viejo = await generarRespaldo(deps, p.ctx);

    await fijarContrasenaRespaldo(deps, 'otra contraseña nueva', 'otra contraseña nueva');
    const llaveNueva = leerLlaveRespaldo(deps.almacen);
    expect(Buffer.from(llaveNueva?.sal ?? []).toString('hex')).not.toBe(
      Buffer.from(llaveVieja?.sal ?? []).toString('hex'),
    );
    expect(Buffer.from(llaveNueva?.llave ?? []).toString('hex')).not.toBe(
      Buffer.from(llaveVieja?.llave ?? []).toString('hex'),
    );
    const nuevo = await generarRespaldo(deps, p.ctx);

    expect((await prepararRestauracion(deps, viejo, CONTRASENA)).movimientos).toBeGreaterThan(0);
    expect(await codigoDe(prepararRestauracion(deps, viejo, 'otra contraseña nueva'))).toBe(
      'respaldo_corrupto_o_contrasena_incorrecta',
    );
    expect((await prepararRestauracion(deps, nuevo, 'otra contraseña nueva')).movimientos).toBeGreaterThan(0);
    p.base.cerrar();
  }, 60_000);

  it('contraseña equivocada y archivo alterado dan el mismo error y el mismo mensaje', async () => {
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    const deps = dependencias();
    await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
    const archivo = await generarRespaldo(deps, p.ctx);
    const alterado = archivo.slice();
    alterado[alterado.length - 40] = (alterado[alterado.length - 40] ?? 0) ^ 1;

    const errores: unknown[] = [];
    // Uno tras otro: la segunda promesa no debe quedar rechazada sin manejador mientras corre la primera.
    for (const intento of [
      () => prepararRestauracion(deps, archivo, 'no es la contraseña'),
      () => prepararRestauracion(deps, alterado, CONTRASENA),
    ]) {
      await intento().catch((e: unknown) => errores.push(e));
    }
    expect(errores.map((e) => (e as ErrorDominio).codigo)).toEqual([
      'respaldo_corrupto_o_contrasena_incorrecta',
      'respaldo_corrupto_o_contrasena_incorrecta',
    ]);
    expect(errores.map(mensajeErrorRespaldo)).toEqual([MENSAJE_NO_ABRE, MENSAJE_NO_ABRE]);
    p.base.cerrar();
  }, 30_000);

  it('valida la contraseña nueva: mínimo 10 caracteres y escrita dos veces igual', async () => {
    expect(validarContrasenaNueva('corta', 'corta')).toBe('corta');
    expect(validarContrasenaNueva('suficientemente larga', 'suficientemente largo')).toBe('no_coincide');
    expect(validarContrasenaNueva('suficientemente larga', 'suficientemente larga')).toBeNull();
    // NFKC: la misma contraseña tecleada con otra composición coincide.
    expect(validarContrasenaNueva('contraseña segura', 'contraseña segura'.normalize('NFD'))).toBeNull();
    expect(await codigoDe(fijarContrasenaRespaldo(dependencias(), 'corta', 'corta'))).toBe(
      'contrasena_corta',
    );
  });

  /** Arma un `.cartera` válido con el contenido dado (para probar la validación del contenido). */
  async function conContenido(contenido: unknown, deps: DependenciasRespaldo): Promise<Uint8Array> {
    await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
    const llave = leerLlaveRespaldo(deps.almacen);
    if (!llave) throw new Error('sin llave');
    return escribirRespaldo(criptoNode, llave, JSON.stringify(contenido), {
      creadoEn: '2026-10-11T00:00:00Z',
      versionEsquema: 1,
    });
  }

  it('rechaza contenido con tablas o columnas que no existen, sin tocar la base', async () => {
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    const datos = datosExportacion(p.ctx);
    const deps = dependencias();
    const tablaExtra = await conContenido({ ...datos, tablas: { ...datos.tablas, otra: [] } }, deps);
    expect(await codigoDe(prepararRestauracion(deps, tablaExtra, CONTRASENA))).toBe('respaldo_invalido');
    const columnaExtra = await conContenido(
      {
        ...datos,
        tablas: { ...datos.tablas, ajuste: [{ clave: 'x', valor: '1', actualizado_en: 0, extra: 1 }] },
      },
      deps,
    );
    expect(await codigoDe(prepararRestauracion(deps, columnaExtra, CONTRASENA))).toBe('respaldo_invalido');
    const futuro = await conContenido({ ...datos, version_esquema: MIGRACIONES.length + 1 }, deps);
    expect(await codigoDe(prepararRestauracion(deps, futuro, CONTRASENA))).toBe(
      'respaldo_version_no_soportada',
    );
    // Un libro que no suma cero no pasa la comprobación de integridad del ensayo.
    const asientos = datos.tablas.asiento ?? [];
    const descuadrado = await conContenido(
      {
        ...datos,
        tablas: { ...datos.tablas, asiento: [{ ...asientos[0], monto: 1 }, ...asientos.slice(1)] },
      },
      deps,
    );
    expect(await codigoDe(prepararRestauracion(deps, descuadrado, CONTRASENA))).toBe('respaldo_invalido');
    p.base.cerrar();
  }, 60_000);

  it('un respaldo de un esquema anterior (sin la tabla tanda de 0002) se importa y se migra a la versión actual', async () => {
    const p = abrirPrueba('2026-10-11');
    cargarEscenario(p.ctx, escenario('e4-01'));
    // Lo que exportaba una app con solo 0001_inicial: sin las tablas de 0002 a 0004 y con version_esquema 1.
    const tablas = { ...datosExportacion(p.ctx).tablas };
    delete tablas.tanda;
    delete tablas.suscripcion;
    delete tablas.plantilla_remota;
    delete tablas.cfdi;
    const deps = dependencias();
    const archivo = await conContenido({ ...datosExportacion(p.ctx), version_esquema: 1, tablas }, deps);

    const listo = await prepararRestauracion(deps, archivo, CONTRASENA);
    const restaurada = restaurarRespaldo(deps, listo);
    const nuevo = crearContexto({ db: restaurada.db, reloj: p.reloj, generarId: crearGeneradorSecuencial() });
    expect(saldos(nuevo)).toEqual(saldos(p.ctx));
    expect(obtenerHoy(nuevo)).toEqual(obtenerHoy(p.ctx));
    expect(datosExportacion(nuevo).version_esquema).toBe(MIGRACIONES.length);
    expect(nuevo.db.all(sql`SELECT * FROM tanda`)).toEqual([]);
    restaurada.cerrar();
    p.base.cerrar();
  }, 60_000);

  it('textos de UI: resumen y "Listo: recuperé…" con separador de miles y singular', () => {
    expect(resumenRespaldo({ fecha: '2026-10-11', movimientos: 1284 })).toBe(
      'Tu respaldo del 11 oct 2026 trae 1,284 movimientos.',
    );
    expect(mensajeRestaurado({ movimientos: 1284 })).toBe('Listo: recuperé 1,284 movimientos');
    expect(mensajeRestaurado({ movimientos: 1 })).toBe('Listo: recuperé 1 movimiento');
    expect(mensajeRestaurado({ movimientos: 1_234_567 })).toBe('Listo: recuperé 1,234,567 movimientos');
  });

  it('borrar todo destruye la llave del respaldo', async () => {
    expect(LLAVES_ALMACEN).toContain(CLAVE_LLAVE_RESPALDO);
    const deps = dependencias();
    await fijarContrasenaRespaldo(deps, CONTRASENA, CONTRASENA);
    await borrarTodo({ base: null, puerto: puertoNode(), almacen: deps.almacen });
    expect(tieneContrasenaRespaldo(deps)).toBe(false);
  });
});
