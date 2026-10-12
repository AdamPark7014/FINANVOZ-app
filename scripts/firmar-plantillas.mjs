#!/usr/bin/env node
// Firma un archivo de plantillas con Ed25519 (docs/07-CAPTURA.md §3.1).
//
//   node scripts/firmar-plantillas.mjs <archivo.json>              # producción: llave en CARTERA_PLANTILLAS_LLAVE_PRIVADA_HEX
//   node scripts/firmar-plantillas.mjs <archivo.json> --llave-prueba   # fixtures: llave PÚBLICA del vector 1 de RFC 8032
//
// Escribe <archivo.json>.sig (firma en base64 + salto de línea) e imprime la llave pública y el SHA-256 del archivo.
// La llave privada de producción nunca entra al repositorio ni a la app.
import { createPrivateKey, createPublicKey, sign, verify, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const LLAVE_PRUEBA_RFC8032 = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const PREFIJO_PKCS8 = '302e020100300506032b657004220420'; // Ed25519, llave privada de 32 bytes

const [archivo, ...banderas] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: node scripts/firmar-plantillas.mjs <archivo.json> [--llave-prueba]');
  process.exit(2);
}
const hex = banderas.includes('--llave-prueba') ? LLAVE_PRUEBA_RFC8032 : process.env.CARTERA_PLANTILLAS_LLAVE_PRIVADA_HEX;
if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
  console.error('Falta la llave: define CARTERA_PLANTILLAS_LLAVE_PRIVADA_HEX (64 hex) o usa --llave-prueba.');
  process.exit(2);
}
const privada = createPrivateKey({ key: Buffer.from(PREFIJO_PKCS8 + hex, 'hex'), format: 'der', type: 'pkcs8' });
const publica = createPublicKey(privada);
const datos = readFileSync(archivo);
const firma = sign(null, datos, privada);
if (!verify(null, datos, publica, firma)) throw new Error('la firma recién hecha no verifica');
writeFileSync(`${archivo}.sig`, firma.toString('base64') + '\n');
const crudaPublica = publica.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
console.log(JSON.stringify({
  archivo,
  firma: `${archivo}.sig`,
  llave_publica_hex: crudaPublica,
  sha256_archivo: createHash('sha256').update(datos).digest('hex'),
}, null, 2));
