/**
 * Adaptador de la app: expo-sqlite (con SQLCipher, `useSQLCipher: true` en app.json), expo-secure-store y
 * expo-crypto. Es lo único de `db/` que importa módulos nativos; se valida en el dispositivo (CA-M2-04: el
 * archivo no abre con `sqlite3` sin llave). Las pruebas en Node usan `node.ts`.
 */
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { deleteDatabaseSync, openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { BaseDatos } from '@cartera/datos';
import { abrirBaseCifrada, type BaseAbierta, type PuertoSqlite } from './abrir';
import type { AlmacenSeguro } from './llave';

/** Nombre del archivo de la base (excluido de Auto Backup: `android.allowBackup = false`). */
export const ARCHIVO_BASE = 'cartera.db';

/**
 * Todas las llaves del almacén seguro: sin autenticación y accesibles con el teléfono bloqueado después del
 * primer desbloqueo (`04 §7`), para que la tarea diaria y el widget puedan abrir la base.
 */
const OPCIONES_ALMACEN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export const almacenExpo: AlmacenSeguro = {
  obtener: (clave) => SecureStore.getItem(clave, OPCIONES_ALMACEN),
  guardar: (clave, valor) => SecureStore.setItem(clave, valor, OPCIONES_ALMACEN),
  borrar: (clave) => SecureStore.deleteItemAsync(clave, OPCIONES_ALMACEN),
};

export const puertoExpo: PuertoSqlite = {
  abrir() {
    const cliente = openDatabaseSync(ARCHIVO_BASE);
    return {
      ejecutar: (sentencia) => cliente.execSync(sentencia),
      drizzle: () => drizzle(cliente) as unknown as BaseDatos,
      cerrar: () => cliente.closeSync(),
    };
  },
  eliminarArchivo() {
    try {
      deleteDatabaseSync(ARCHIVO_BASE);
    } catch {
      // No existe: nada que borrar.
    }
  },
};

/** Base desechable en memoria (ensayo de una restauración antes de reemplazar la base real, M9). */
export function puertoMemoriaExpo(): PuertoSqlite {
  return {
    abrir() {
      const cliente = openDatabaseSync(':memory:');
      return {
        ejecutar: (sentencia) => cliente.execSync(sentencia),
        drizzle: () => drizzle(cliente) as unknown as BaseDatos,
        cerrar: () => cliente.closeSync(),
      };
    },
    eliminarArchivo() {},
  };
}

/** Abre la base de la app (llave en el almacén seguro, `PRAGMA key`, migraciones). */
export function abrirBaseApp(): BaseAbierta {
  return abrirBaseCifrada({ puerto: puertoExpo, almacen: almacenExpo, aleatorio: getRandomBytes });
}

/** Bytes aleatorios del sistema (para ids UUIDv7). */
export const aleatorioExpo: (n: number) => Uint8Array = getRandomBytes;
