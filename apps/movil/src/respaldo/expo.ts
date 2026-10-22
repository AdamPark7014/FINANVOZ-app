/**
 * Adaptador del respaldo en el teléfono (spike de M9, `docs/ESTADO.md` → Decisiones):
 *
 * - scrypt con `react-native-quick-crypto` (OpenSSL nativo vía JSI): en JS puro (`@noble/hashes`) `n = 2^17`
 *   rebasa por mucho los 3 s de CA-M9-03 en un intérprete sin JIT como Hermes.
 * - AES-256-GCM y aleatorios con `expo-crypto` (Expo SDK, ya en la app).
 * - Archivos con `expo-file-system`, `expo-sharing` y `expo-document-picker`.
 *
 * Es lo único del respaldo que importa módulos nativos; las pruebas usan `@cartera/respaldo/node`.
 */
import {
  aesDecryptAsync,
  aesEncryptAsync,
  AESEncryptionKey,
  AESSealedData,
  getRandomBytes,
} from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ErrorDominio } from '@cartera/core';
import type { CriptoRespaldo } from '@cartera/respaldo';
import { almacenExpo, puertoExpo, puertoMemoriaExpo } from '../db/expo';
import type { ArchivosRespaldo, DependenciasRespaldo } from '../servicios/respaldo';

/** `maxmem` de scrypt: n = 2^17, r = 8 usa 128 MiB (E16 pide un límite de al menos 256 MiB). */
const MAXMEM = 256 * 1024 * 1024;
const ETIQUETA = 16;
/** Un `.cartera` más grande que esto no se lee (el contenido descomprimido tope es 200 MB). */
const TAMANO_MAXIMO_ARCHIVO = 250 * 1024 * 1024;

export const criptoExpo: CriptoRespaldo = {
  async scrypt(contrasena, sal, { n, r, p, largo }) {
    // Carga perezosa: el módulo nativo solo se toca al crear la contraseña, respaldar o restaurar.
    const { scrypt } = await import('react-native-quick-crypto');
    return new Promise((ok, mal) => {
      scrypt(contrasena, sal, largo, { N: n, r, p, maxmem: MAXMEM }, (error, llave) => {
        if (error || !llave) mal(error ?? new Error('scrypt'));
        else ok(new Uint8Array(llave.buffer, llave.byteOffset, llave.byteLength).slice());
      });
    });
  },
  async aesGcmCifrar(llave, nonce, texto, aad) {
    const clave = await AESEncryptionKey.import(llave);
    const sellado = await aesEncryptAsync(texto, clave, {
      nonce: { bytes: nonce },
      additionalData: aad,
      tagLength: ETIQUETA,
    });
    return sellado.ciphertext({ includeTag: true, encoding: 'bytes' });
  },
  async aesGcmDescifrar(llave, nonce, cifrado, aad) {
    const clave = await AESEncryptionKey.import(llave);
    const sellado = AESSealedData.fromParts(nonce, cifrado, ETIQUETA);
    return aesDecryptAsync(sellado, clave, { additionalData: aad, output: 'bytes' });
  },
  aleatorio: getRandomBytes,
};

export const dependenciasRespaldoExpo: DependenciasRespaldo = {
  cripto: criptoExpo,
  almacen: almacenExpo,
  aleatorio: getRandomBytes,
  puertoBase: puertoExpo,
  puertoEnsayo: puertoMemoriaExpo,
};

/** Escribe el `.cartera` en la caché y abre la hoja de compartir (el archivo ya va cifrado). */
async function compartir(nombre: string, bytes: Uint8Array): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new ErrorDominio('compartir_no_disponible', 'sin hoja de compartir');
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/octet-stream',
    // iOS elige las apps de la hoja por el UTI: `.cartera` no tiene uno propio declarado, así que va como datos
    // genéricos (Archivos, AirDrop, correo). Sin él la hoja puede salir casi vacía.
    UTI: 'public.data',
    dialogTitle: 'Tu respaldo de Finanvoz',
  });
}

/** Abre el selector de archivos del sistema; `null` si la persona cancela. */
async function elegir(): Promise<Uint8Array | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  const elegido = r.canceled ? undefined : r.assets[0];
  if (!elegido) return null;
  if (elegido.size !== undefined && elegido.size > TAMANO_MAXIMO_ARCHIVO)
    throw new ErrorDominio('respaldo_no_reconocido', 'archivo demasiado grande');
  const archivo = new File(elegido.uri);
  try {
    return await archivo.bytes();
  } finally {
    try {
      archivo.delete();
    } catch {
      // La copia de la caché se limpia sola si no se pudo borrar.
    }
  }
}

export const archivosRespaldoExpo: ArchivosRespaldo = { compartir, elegir };
