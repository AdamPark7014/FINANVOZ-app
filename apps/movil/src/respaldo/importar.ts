import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import { comprobarIntegridad, type BaseDatos } from '@cartera/datos';
import { abrirBaseCifrada, type BaseAbierta, type PuertoSqlite } from '../db/abrir';
import type { AlmacenSeguro } from '../db/llave';
import { migrar, type MigracionEmbebida } from '../db/migrar';
import { MIGRACIONES } from '../db/migraciones.generado';
import {
  FORMATO_EXPORTACION,
  TABLAS_EXPORTADAS,
  VERSION_EXPORTACION,
  type DatosExportados,
} from '../privacidad/exportar';

const Valor = z.union([z.string(), z.number(), z.null()]);

/** Contenido del respaldo (`05 §E16`): la exportación completa de `04 §6`, validada con Zod antes de importarla. */
export const DatosRespaldo = z.strictObject({
  formato: z.literal(FORMATO_EXPORTACION),
  version: z.literal(VERSION_EXPORTACION),
  version_esquema: z.int().min(1),
  generado_en: z.number(),
  fecha: z.string(),
  montos: z.literal('centavos'),
  tablas: z.record(z.string(), z.array(z.record(z.string(), Valor))),
});

function invalido(): ErrorDominio {
  return new ErrorDominio('respaldo_invalido', 'el contenido del respaldo no tiene el formato esperado');
}

/** Migraciones en orden de aplicación. */
function ordenadas(migraciones: readonly MigracionEmbebida[]): MigracionEmbebida[] {
  return [...migraciones].sort((a, b) => a.cuando - b.cuando);
}

/** Valida el JSON descifrado. Un respaldo de una versión más nueva de la app no se importa. */
export function validarDatosRespaldo(
  json: string,
  migraciones: readonly MigracionEmbebida[] = MIGRACIONES,
): DatosExportados {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch {
    throw invalido();
  }
  const r = DatosRespaldo.safeParse(crudo);
  if (!r.success) throw invalido();
  if (r.data.version_esquema > migraciones.length)
    throw new ErrorDominio('respaldo_version_no_soportada', 'respaldo de una versión más nueva de la app');
  for (const tabla of Object.keys(r.data.tablas)) {
    if (!TABLAS_EXPORTADAS.includes(tabla)) throw invalido();
  }
  return r.data as DatosExportados;
}

/** Filas por sentencia `INSERT … VALUES (…), (…)`. */
const LOTE = 500;

/**
 * Literal SQL de un valor ya validado por Zod (texto, número o nulo). El texto se cita duplicando comillas
 * simples (SQLite no interpreta otros escapes); un NUL o un número no finito invalidan el respaldo.
 */
function literal(valor: string | number | null): string {
  if (valor === null) return 'NULL';
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw invalido();
    return String(valor);
  }
  if (valor.includes('\0')) throw invalido();
  return `'${valor.replaceAll("'", "''")}'`;
}

/**
 * Inserta todas las filas en una base recién migrada a la versión del respaldo, en una sola transacción. Cada
 * fila debe traer exactamente las columnas de la tabla en esa versión (ningún nombre del archivo llega a SQL sin
 * estar en el esquema) y las llaves foráneas se verifican al confirmar (`defer_foreign_keys`), así el orden de
 * las filas no importa. Van varias filas por sentencia: con 50,000 asientos, una sentencia por fila es lenta.
 */
export function insertarDatos(db: BaseDatos, datos: DatosExportados): void {
  db.transaction((tx) => {
    tx.run(sql.raw('PRAGMA defer_foreign_keys = ON'));
    for (const tabla of TABLAS_EXPORTADAS) {
      const filas = datos.tablas[tabla];
      if (filas === undefined) continue;
      const columnas = tx.all<{ name: string }>(sql.raw(`PRAGMA table_info("${tabla}")`)).map((c) => c.name);
      if (columnas.length === 0) throw invalido();
      // Una base nueva solo trae filas de semilla (cuentas de sistema y catálogo); el respaldo las trae también,
      // con los cambios del usuario (nombres, archivadas).
      tx.run(sql.raw(`DELETE FROM "${tabla}"`));
      const lista = columnas.map((c) => `"${c}"`).join(', ');
      for (let i = 0; i < filas.length; i += LOTE) {
        const valores = filas.slice(i, i + LOTE).map((fila) => {
          const nombres = Object.keys(fila);
          if (nombres.length !== columnas.length || nombres.some((n) => !columnas.includes(n)))
            throw invalido();
          return `(${columnas.map((c) => literal(fila[c] ?? null)).join(', ')})`;
        });
        tx.run(sql.raw(`INSERT INTO "${tabla}" (${lista}) VALUES ${valores.join(', ')}`));
      }
    }
  });
}

/**
 * Restaura en una base nueva (`05 §E16`, "importar en una base nueva y correr la comprobación de integridad"):
 * abre la base con las migraciones hasta la versión del respaldo, inserta, aplica las migraciones restantes y
 * exige integridad vacía. Si algo falla, cierra y elimina el archivo: no queda una base a medias.
 */
export function restaurarEnBaseNueva(opciones: {
  puerto: PuertoSqlite;
  almacen: AlmacenSeguro;
  aleatorio: (n: number) => Uint8Array;
  datos: DatosExportados;
  migraciones?: readonly MigracionEmbebida[];
}): BaseAbierta {
  const todas = ordenadas(opciones.migraciones ?? MIGRACIONES);
  if (opciones.datos.version_esquema > todas.length)
    throw new ErrorDominio('respaldo_version_no_soportada', 'respaldo de una versión más nueva de la app');
  opciones.puerto.eliminarArchivo();
  const base = abrirBaseCifrada({
    puerto: opciones.puerto,
    almacen: opciones.almacen,
    aleatorio: opciones.aleatorio,
    migraciones: todas.slice(0, opciones.datos.version_esquema),
  });
  try {
    insertarDatos(base.db, opciones.datos);
    migrar(base.db, todas);
    if (comprobarIntegridad(base.db).length > 0) throw invalido();
    const fk = base.db.all(sql.raw('PRAGMA foreign_key_check'));
    if (fk.length > 0) throw invalido();
    return base;
  } catch (error) {
    base.cerrar();
    opciones.puerto.eliminarArchivo();
    if (error instanceof ErrorDominio) throw error;
    // Restricciones de SQLite (CHECK, UNIQUE, llaves foráneas): el detalle podría traer datos (regla 9).
    throw invalido();
  }
}
