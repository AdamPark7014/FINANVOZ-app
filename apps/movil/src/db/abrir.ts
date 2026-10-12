import type { BaseDatos } from '@cartera/datos';
import { obtenerOCrearLlave, pragmaLlave, type AlmacenSeguro } from './llave';
import { migrar, type MigracionEmbebida } from './migrar';
import { MIGRACIONES } from './migraciones.generado';

/** Conexión SQLite nativa recién abierta, antes de aplicar la llave. */
export interface ClienteSqlite {
  /** Ejecuta una sentencia sin resultados (`PRAGMA`). */
  ejecutar(sentencia: string): void;
  /** Envuelve la conexión en Drizzle síncrono. */
  drizzle(): BaseDatos;
  cerrar(): void;
}

/**
 * Adaptador delgado del archivo de la base: `expo.ts` en la app (expo-sqlite con SQLCipher) y `node.ts` en
 * pruebas y en el cargador de semillas (better-sqlite3). Nada más depende del driver.
 */
export interface PuertoSqlite {
  abrir(): ClienteSqlite;
  /** Elimina el archivo (la base ya está cerrada). No falla si no existe. */
  eliminarArchivo(): void;
}

export interface BaseAbierta {
  readonly db: BaseDatos;
  cerrar(): void;
}

/**
 * Abre la base cifrada (`docs/04-DATOS.md §7`): obtiene o crea la llave en el almacén seguro, la aplica con
 * `PRAGMA key` antes de cualquier otra consulta, activa las llaves foráneas y aplica las migraciones pendientes.
 */
export function abrirBaseCifrada(opciones: {
  puerto: PuertoSqlite;
  almacen: AlmacenSeguro;
  aleatorio: (n: number) => Uint8Array;
  migraciones?: readonly MigracionEmbebida[];
}): BaseAbierta {
  const llave = obtenerOCrearLlave(opciones.almacen, opciones.aleatorio);
  const cliente = opciones.puerto.abrir();
  try {
    cliente.ejecutar(pragmaLlave(llave));
    cliente.ejecutar('PRAGMA foreign_keys = ON');
    const db = cliente.drizzle();
    migrar(db, opciones.migraciones ?? MIGRACIONES);
    return { db, cerrar: () => cliente.cerrar() };
  } catch (error) {
    cliente.cerrar();
    throw error;
  }
}
