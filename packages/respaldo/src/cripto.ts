/**
 * Criptografía inyectada (`docs/03-ARQUITECTURA.md §4`): el formato no importa ninguna biblioteca; en pruebas
 * recibe `node:crypto` (`./node`) y en la app la biblioteca elegida en el spike de M9 (`docs/ESTADO.md`).
 */
export interface CriptoRespaldo {
  /** scrypt crudo (RFC 7914). Debe admitir `n = 2^17, r = 8` (128 MiB): límite de memoria ≥ 256 MiB. */
  scrypt(
    contrasena: Uint8Array,
    sal: Uint8Array,
    parametros: { n: number; r: number; p: number; largo: number },
  ): Promise<Uint8Array>;
  /** AES-256-GCM. Devuelve `texto cifrado ‖ etiqueta de 16 bytes`. */
  aesGcmCifrar(llave: Uint8Array, nonce: Uint8Array, texto: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  /** Inverso de `aesGcmCifrar`; lanza (cualquier error) si la etiqueta no verifica. */
  aesGcmDescifrar(
    llave: Uint8Array,
    nonce: Uint8Array,
    cifrado: Uint8Array,
    aad: Uint8Array,
  ): Promise<Uint8Array>;
  /** Bytes aleatorios criptográficamente seguros. */
  aleatorio(n: number): Uint8Array;
}
