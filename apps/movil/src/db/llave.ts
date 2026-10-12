import { ErrorDominio } from '@cartera/core';

/**
 * Almacén seguro del sistema (Android Keystore / Keychain). La app usa `expo-secure-store` sin
 * `requireAuthentication` y con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`docs/04-DATOS.md §7`); las pruebas usan
 * un mapa en memoria.
 */
export interface AlmacenSeguro {
  obtener(clave: string): string | null;
  guardar(clave: string, valor: string): void;
  borrar(clave: string): Promise<void>;
}

/** Nombre de la llave de la base en el almacén seguro. */
export const CLAVE_LLAVE_BASE = 'cartera.base.llave.v1';

/** Bytes de la llave de SQLCipher (`04 §7`: 32 bytes aleatorios). */
export const BYTES_LLAVE = 32;

const HEX = /^[0-9a-f]{64}$/;

function aHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/**
 * Devuelve la llave en hexadecimal; si no existe la genera una sola vez con `aleatorio` y la guarda. Una llave
 * guardada con otro formato es un error (no se reemplaza: la base existente quedaría ilegible sin aviso).
 */
export function obtenerOCrearLlave(almacen: AlmacenSeguro, aleatorio: (n: number) => Uint8Array): string {
  const guardada = almacen.obtener(CLAVE_LLAVE_BASE);
  if (guardada !== null) {
    if (!HEX.test(guardada)) throw new ErrorDominio('llave_invalida', 'la llave guardada no es válida');
    return guardada;
  }
  const bytes = aleatorio(BYTES_LLAVE);
  if (bytes.length !== BYTES_LLAVE)
    throw new ErrorDominio('llave_invalida', 'aleatorio devolvió otro tamaño');
  const llave = aHex(bytes);
  almacen.guardar(CLAVE_LLAVE_BASE, llave);
  return llave;
}

/**
 * `PRAGMA key` con llave cruda (sin derivación PBKDF2: ya son 32 bytes aleatorios). Va inmediatamente después de
 * abrir y antes de cualquier otra consulta, incluidas las migraciones (`04 §7`).
 */
export function pragmaLlave(llaveHex: string): string {
  if (!HEX.test(llaveHex))
    throw new ErrorDominio('llave_invalida', 'la llave debe ser hexadecimal de 32 bytes');
  return `PRAGMA key = "x'${llaveHex}'"`;
}

/** Almacén en memoria para pruebas y para el cargador de semillas en Node. */
export function almacenEnMemoria(): AlmacenSeguro & { readonly valores: Map<string, string> } {
  const valores = new Map<string, string>();
  return {
    valores,
    obtener: (clave) => valores.get(clave) ?? null,
    guardar: (clave, valor) => {
      valores.set(clave, valor);
    },
    borrar: async (clave) => {
      valores.delete(clave);
    },
  };
}
