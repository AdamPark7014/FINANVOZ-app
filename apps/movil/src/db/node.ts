/**
 * Adaptador de Node (better-sqlite3) para pruebas y para el cargador de semillas. better-sqlite3 no trae
 * SQLCipher: `PRAGMA key` se ignora, así que el cifrado solo se verifica en el dispositivo (CA-M2-04).
 * No lo importes desde la app.
 */
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BaseDatos } from '@cartera/datos';
import type { PuertoSqlite } from './abrir';

/** Puerto sobre un archivo (o `:memory:`; en memoria `eliminarArchivo` no hace nada). */
export function puertoNode(archivo = ':memory:'): PuertoSqlite {
  return {
    abrir() {
      const cliente = new Database(archivo);
      return {
        ejecutar: (sentencia) => {
          cliente.exec(sentencia);
        },
        drizzle: () => drizzle({ client: cliente }) as unknown as BaseDatos,
        cerrar: () => cliente.close(),
      };
    },
    eliminarArchivo() {
      if (archivo === ':memory:') return;
      for (const sufijo of ['', '-wal', '-shm', '-journal']) rmSync(`${archivo}${sufijo}`, { force: true });
    },
  };
}

export const aleatorioNode = (n: number): Uint8Array => new Uint8Array(randomBytes(n));
