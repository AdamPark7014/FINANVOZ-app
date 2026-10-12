/**
 * Criptografía de Node (`node:crypto`) para pruebas, scripts y las pruebas de la app en Node. No la importes
 * desde código que corre en el teléfono.
 */
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import type { CriptoRespaldo } from './cripto';

/** `maxmem` de Node: el valor por omisión (32 MiB) falla con n = 2^17, r = 8 (E16). */
const MAXMEM = 256 * 1024 * 1024;
const ETIQUETA = 16;

export const criptoNode: CriptoRespaldo = {
  scrypt: (contrasena, sal, { n, r, p, largo }) =>
    new Promise((ok, mal) => {
      scrypt(contrasena, sal, largo, { N: n, r, p, maxmem: MAXMEM }, (error, llave) =>
        error ? mal(error) : ok(new Uint8Array(llave)),
      );
    }),
  aesGcmCifrar: async (llave, nonce, texto, aad) => {
    const c = createCipheriv('aes-256-gcm', llave, nonce, { authTagLength: ETIQUETA });
    c.setAAD(aad);
    const cuerpo = Buffer.concat([c.update(texto), c.final(), c.getAuthTag()]);
    return new Uint8Array(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength);
  },
  aesGcmDescifrar: async (llave, nonce, cifrado, aad) => {
    if (cifrado.length < ETIQUETA) throw new Error('cifrado corto');
    const d = createDecipheriv('aes-256-gcm', llave, nonce, { authTagLength: ETIQUETA });
    d.setAAD(aad);
    d.setAuthTag(cifrado.subarray(cifrado.length - ETIQUETA));
    const texto = Buffer.concat([d.update(cifrado.subarray(0, cifrado.length - ETIQUETA)), d.final()]);
    return new Uint8Array(texto.buffer, texto.byteOffset, texto.byteLength);
  },
  aleatorio: (n) => new Uint8Array(randomBytes(n)),
};
