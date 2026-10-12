/**
 * Respaldo para pruebas de pantallas con jest-expo: `node:crypto` en lugar de quick-crypto y expo-crypto,
 * almacén en memoria y bases better-sqlite3. Los archivos (hoja de compartir y selector) son simulados.
 */
import { scryptSync } from 'node:crypto';
import type { CriptoRespaldo } from '@cartera/respaldo';
import { criptoNode } from '@cartera/respaldo/node';
import { almacenEnMemoria } from '../../../db/llave';
import { aleatorioNode, puertoNode } from '../../../db/node';
import type { ArchivosRespaldo, DependenciasRespaldo } from '../../../servicios';

/**
 * scrypt síncrono: los workers de jest se reutilizan entre archivos y una suite anterior puede dejar ocupado el
 * pool de hilos de libuv (donde corre el scrypt asíncrono de Node); así la prueba no depende del orden.
 */
const criptoJest: CriptoRespaldo = {
  ...criptoNode,
  scrypt: async (contrasena, sal, { n, r, p, largo }) =>
    new Uint8Array(scryptSync(contrasena, sal, largo, { N: n, r, p, maxmem: 256 * 1024 * 1024 })),
};

export function crearRespaldoPrueba(): {
  deps: DependenciasRespaldo & { almacen: ReturnType<typeof almacenEnMemoria> };
  archivos: ArchivosRespaldo & { compartir: jest.Mock; elegir: jest.Mock };
} {
  return {
    deps: {
      cripto: criptoJest,
      almacen: almacenEnMemoria(),
      aleatorio: aleatorioNode,
      puertoBase: puertoNode(),
      puertoEnsayo: () => puertoNode(),
    },
    archivos: {
      compartir: jest.fn(async () => {}),
      elegir: jest.fn(async () => null),
    },
  };
}
