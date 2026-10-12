/**
 * XChaCha20-Poly1305 con `@noble/ciphers` (JS puro, auditado, sin código nativo): corre igual en Hermes, en Node y
 * en jest, y es de la misma familia que `@noble/hashes` y `@noble/curves`, que la app ya usa. Los eventos pesan
 * unos cientos de bytes, así que la velocidad de JS puro sobra. Los aleatorios se inyectan.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { CriptoSincronizacion } from './cripto';

export function crearCriptoNoble(aleatorio: (n: number) => Uint8Array): CriptoSincronizacion {
  return {
    xchacha20poly1305Cifrar: async (llave, nonce, texto, aad) =>
      xchacha20poly1305(llave, nonce, aad).encrypt(texto),
    xchacha20poly1305Descifrar: async (llave, nonce, cifrado, aad) =>
      xchacha20poly1305(llave, nonce, aad).decrypt(cifrado),
    aleatorio,
  };
}
