/**
 * Criptografía inyectada de E17 (`docs/05-MOTORES.md §E17`): `node:crypto` no trae XChaCha20-Poly1305, así que en
 * pruebas y en la app se usa `@noble/ciphers` (`./noble`). Los aleatorios también llegan de fuera: `node:crypto`
 * en Node y `expo-crypto` en el teléfono (Hermes no garantiza `crypto.getRandomValues`).
 */
export interface CriptoSincronizacion {
  /** XChaCha20-Poly1305 con nonce de 24 bytes. Devuelve `texto cifrado ‖ etiqueta de 16 bytes`. */
  xchacha20poly1305Cifrar(
    llave: Uint8Array,
    nonce: Uint8Array,
    texto: Uint8Array,
    aad: Uint8Array,
  ): Promise<Uint8Array>;
  /** Inverso de `xchacha20poly1305Cifrar`; lanza (cualquier error) si la etiqueta no verifica. */
  xchacha20poly1305Descifrar(
    llave: Uint8Array,
    nonce: Uint8Array,
    cifrado: Uint8Array,
    aad: Uint8Array,
  ): Promise<Uint8Array>;
  /** Bytes aleatorios criptográficamente seguros. */
  aleatorio(n: number): Uint8Array;
}
