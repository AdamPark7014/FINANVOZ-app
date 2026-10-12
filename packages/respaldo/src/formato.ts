import { ErrorDominio } from '@cartera/core';
import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { aBase64, deBase64 } from './base64';
import type { CriptoRespaldo } from './cripto';

/**
 * Formato `.cartera` (`docs/05-MOTORES.md §E16`):
 *
 *   "CARTERA1" | largo del encabezado (uint32 BE) | encabezado (JSON UTF-8 canónico) | AES-256-GCM(gzip(json)) ‖ etiqueta
 *
 * El encabezado completo es el AAD: cambiar un byte de él o del cifrado falla igual que una contraseña equivocada.
 */

export const MAGIA = 'CARTERA1';
const BYTES_MAGIA = 8;
const BYTES_PREFIJO = BYTES_MAGIA + 4;
/** Encabezado máximo que se lee (E16: ≤ 4 KiB). */
export const LARGO_MAX_ENCABEZADO = 4096;
/** Tamaño máximo del contenido descomprimido (E16: 200 MB). */
export const LIMITE_DESCOMPRIMIDO = 200 * 1024 * 1024;

export const N_PRODUCCION = 2 ** 17;
/** Lista blanca de `n` (E16). `2^16` es el escalón si `2^17` tarda más de 3 s en el teléfono de referencia. */
export const N_PERMITIDOS: readonly number[] = [2 ** 16, 2 ** 17];
/** Solo con `permitirParametrosDePrueba` (vectores rápidos y `fixtures/respaldo`). */
export const N_PRUEBA = 2 ** 14;
export const R = 8;
export const P = 1;
export const BYTES_SAL = 16;
export const BYTES_NONCE = 12;
export const BYTES_LLAVE = 32;
const BYTES_ETIQUETA = 16;

/** Mismo error para un archivo alterado y para una contraseña equivocada (no se distinguen a propósito). */
export const ERROR_CORRUPTO = 'respaldo_corrupto_o_contrasena_incorrecta';

export interface OpcionesFormato {
  /** Permite `n = 2^14` (solo pruebas; E16). */
  permitirParametrosDePrueba?: boolean;
}

export interface OpcionesApertura extends OpcionesFormato {
  /** Límite del contenido descomprimido en bytes (por omisión 200 MB). */
  limiteDescomprimido?: number;
}

const esquemaEncabezado = z.strictObject({
  formato: z.literal('cartera-respaldo'),
  version: z.literal(1),
  kdf: z.strictObject({
    alg: z.literal('scrypt'),
    n: z.number().int(),
    r: z.number().int(),
    p: z.number().int(),
    sal_b64: z.string(),
  }),
  cifrado: z.strictObject({
    alg: z.literal('AES-256-GCM'),
    nonce_b64: z.string(),
  }),
  creado_en: z.string().max(64),
  version_esquema: z.number().int().min(1),
  contenido: z.literal('json+gzip'),
});

export type Encabezado = z.infer<typeof esquemaEncabezado>;

/** Llave de respaldo: lo que se guarda en el almacén seguro (la contraseña nunca se guarda). */
export interface LlaveRespaldo {
  llave: Uint8Array;
  sal: Uint8Array;
  n: number;
  r: number;
  p: number;
}

function error(codigo: string, mensaje: string): ErrorDominio {
  return new ErrorDominio(codigo, mensaje);
}

function nPermitido(n: number, opciones: OpcionesFormato): boolean {
  return N_PERMITIDOS.includes(n) || (opciones.permitirParametrosDePrueba === true && n === N_PRUEBA);
}

/** Valida los parámetros de derivación y cifrado contra la lista blanca. */
export function validarParametros(
  p: { n: number; r: number; p: number; sal: Uint8Array | null; nonce?: Uint8Array | null },
  opciones: OpcionesFormato = {},
): void {
  const valido =
    nPermitido(p.n, opciones) &&
    p.r === R &&
    p.p === P &&
    p.sal?.length === BYTES_SAL &&
    (p.nonce === undefined || p.nonce?.length === BYTES_NONCE);
  if (!valido)
    throw error('respaldo_parametros_no_permitidos', 'parámetros del respaldo fuera de la lista blanca');
}

/** JSON con llaves ordenadas y sin espacios (los bytes del encabezado son el AAD). */
export function serializarEncabezado(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarEncabezado).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${serializarEncabezado(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

export interface ArchivoLeido {
  encabezado: Encabezado;
  /** Bytes exactos del encabezado (AAD). */
  bytesEncabezado: Uint8Array;
  sal: Uint8Array;
  nonce: Uint8Array;
  cifrado: Uint8Array;
}

/**
 * Lee y valida el encabezado **sin derivar nada** (E16): magia, largo ≤ 4 KiB, JSON, formato, versión y lista
 * blanca de parámetros. Sirve también para listar respaldos (fecha de creación) sin pedir la contraseña.
 */
export function leerEncabezado(archivo: Uint8Array, opciones: OpcionesFormato = {}): ArchivoLeido {
  const noReconocido = () => error('respaldo_no_reconocido', 'el archivo no es un respaldo de Cartera');
  if (archivo.length < BYTES_PREFIJO || strFromU8(archivo.subarray(0, BYTES_MAGIA), true) !== MAGIA)
    throw noReconocido();
  const largo = new DataView(archivo.buffer, archivo.byteOffset, archivo.byteLength).getUint32(
    BYTES_MAGIA,
    false,
  );
  if (largo === 0 || largo > LARGO_MAX_ENCABEZADO || archivo.length < BYTES_PREFIJO + largo + BYTES_ETIQUETA)
    throw noReconocido();
  const bytesEncabezado = archivo.subarray(BYTES_PREFIJO, BYTES_PREFIJO + largo);
  let crudo: unknown;
  try {
    crudo = JSON.parse(strFromU8(bytesEncabezado));
  } catch {
    throw error(ERROR_CORRUPTO, 'encabezado ilegible');
  }
  if (
    crudo === null ||
    typeof crudo !== 'object' ||
    (crudo as { formato?: unknown }).formato !== 'cartera-respaldo'
  )
    throw noReconocido();
  if ((crudo as { version?: unknown }).version !== 1)
    throw error('respaldo_version_no_soportada', 'respaldo de una versión más nueva de la app');
  const r = esquemaEncabezado.safeParse(crudo);
  if (!r.success) throw error('respaldo_parametros_no_permitidos', 'encabezado fuera de la lista blanca');
  const encabezado = r.data;
  const sal = deBase64(encabezado.kdf.sal_b64);
  const nonce = deBase64(encabezado.cifrado.nonce_b64);
  validarParametros({ n: encabezado.kdf.n, r: encabezado.kdf.r, p: encabezado.kdf.p, sal, nonce }, opciones);
  return {
    encabezado,
    bytesEncabezado,
    sal: sal as Uint8Array,
    nonce: nonce as Uint8Array,
    cifrado: archivo.subarray(BYTES_PREFIJO + largo),
  };
}

/** `NFKC(contraseña)` en UTF-8 (E16-03: la misma contraseña tecleada con otra composición da la misma llave). */
export function normalizarContrasena(contrasena: string): Uint8Array {
  return strToU8(contrasena.normalize('NFKC'));
}

/** `scrypt(NFKC(contraseña), sal, n, r, p, largo)`. No aplica la lista blanca (los vectores E16.kdf usan otros). */
export function derivarLlave(
  cripto: CriptoRespaldo,
  contrasena: string,
  sal: Uint8Array,
  parametros: { n: number; r: number; p: number; largo?: number },
): Promise<Uint8Array> {
  const { n, r, p, largo = BYTES_LLAVE } = parametros;
  return cripto.scrypt(normalizarContrasena(contrasena), sal, { n, r, p, largo });
}

/**
 * Al crear o cambiar la contraseña de respaldo: sal nueva de 16 bytes y su llave. Se guarda la llave con la sal
 * en el almacén seguro; cada respaldo, manual o automático, la reutiliza con un nonce nuevo.
 */
export async function crearLlaveRespaldo(
  cripto: CriptoRespaldo,
  contrasena: string,
  opciones: { n?: number } & OpcionesFormato = {},
): Promise<LlaveRespaldo> {
  const n = opciones.n ?? N_PRODUCCION;
  const sal = cripto.aleatorio(BYTES_SAL);
  validarParametros({ n, r: R, p: P, sal }, opciones);
  const llave = await derivarLlave(cripto, contrasena, sal, { n, r: R, p: P });
  return { llave, sal, n, r: R, p: P };
}

/** Cifra la exportación JSON en un archivo `.cartera` con la llave guardada (no necesita la contraseña). */
export async function escribirRespaldo(
  cripto: CriptoRespaldo,
  llave: LlaveRespaldo,
  contenido: string | Uint8Array,
  opciones: { creadoEn: string; versionEsquema: number } & OpcionesFormato,
): Promise<Uint8Array> {
  const nonce = cripto.aleatorio(BYTES_NONCE);
  validarParametros({ n: llave.n, r: llave.r, p: llave.p, sal: llave.sal, nonce }, opciones);
  if (llave.llave.length !== BYTES_LLAVE)
    throw error('respaldo_parametros_no_permitidos', 'llave de otro tamaño');
  const encabezado: Encabezado = {
    formato: 'cartera-respaldo',
    version: 1,
    kdf: { alg: 'scrypt', n: llave.n, r: llave.r, p: llave.p, sal_b64: aBase64(llave.sal) },
    cifrado: { alg: 'AES-256-GCM', nonce_b64: aBase64(nonce) },
    creado_en: opciones.creadoEn,
    version_esquema: opciones.versionEsquema,
    contenido: 'json+gzip',
  };
  const bytesEncabezado = strToU8(serializarEncabezado(encabezado));
  if (bytesEncabezado.length > LARGO_MAX_ENCABEZADO)
    throw error('respaldo_parametros_no_permitidos', 'encabezado largo');
  const plano = typeof contenido === 'string' ? strToU8(contenido) : contenido;
  const cifrado = await cripto.aesGcmCifrar(
    llave.llave,
    nonce,
    gzipSync(plano, { mtime: 0 }),
    bytesEncabezado,
  );
  const archivo = new Uint8Array(BYTES_PREFIJO + bytesEncabezado.length + cifrado.length);
  archivo.set(strToU8(MAGIA), 0);
  new DataView(archivo.buffer).setUint32(BYTES_MAGIA, bytesEncabezado.length, false);
  archivo.set(bytesEncabezado, BYTES_PREFIJO);
  archivo.set(cifrado, BYTES_PREFIJO + bytesEncabezado.length);
  return archivo;
}

export interface RespaldoAbierto {
  encabezado: Encabezado;
  /** Exportación JSON descomprimida (se valida con Zod en quien la importa). */
  json: string;
}

function descomprimir(datos: Uint8Array, limite: number): Uint8Array {
  const partes: Uint8Array[] = [];
  let total = 0;
  let excedido = false;
  const g = new Gunzip((parte) => {
    total += parte.length;
    if (total > limite) {
      excedido = true;
      throw error('respaldo_demasiado_grande', 'el contenido excede el límite');
    }
    partes.push(parte);
  });
  try {
    g.push(datos, true);
  } catch (e) {
    if (excedido) throw e;
    throw error('respaldo_invalido', 'contenido comprimido ilegible');
  }
  const salida = new Uint8Array(total);
  let i = 0;
  for (const parte of partes) {
    salida.set(parte, i);
    i += parte.length;
  }
  return salida;
}

async function descifrar(
  cripto: CriptoRespaldo,
  leido: ArchivoLeido,
  llave: Uint8Array,
  opciones: OpcionesApertura,
): Promise<RespaldoAbierto> {
  let comprimido: Uint8Array;
  try {
    comprimido = await cripto.aesGcmDescifrar(llave, leido.nonce, leido.cifrado, leido.bytesEncabezado);
  } catch {
    throw error(ERROR_CORRUPTO, 'no se pudo abrir el respaldo');
  }
  const json = strFromU8(descomprimir(comprimido, opciones.limiteDescomprimido ?? LIMITE_DESCOMPRIMIDO));
  return { encabezado: leido.encabezado, json };
}

/**
 * Abre un `.cartera` con la contraseña: valida el encabezado antes de derivar, deriva, descifra y descomprime.
 * Devuelve también la llave derivada con su sal y parámetros.
 */
export async function abrirRespaldo(
  cripto: CriptoRespaldo,
  archivo: Uint8Array,
  contrasena: string,
  opciones: OpcionesApertura = {},
): Promise<RespaldoAbierto & { llave: LlaveRespaldo }> {
  const leido = leerEncabezado(archivo, opciones);
  const { n, r, p } = leido.encabezado.kdf;
  const llave = await derivarLlave(cripto, contrasena, leido.sal, { n, r, p });
  const abierto = await descifrar(cripto, leido, llave, opciones);
  // La llave del respaldo abierto: al restaurar, el teléfono nuevo sigue respaldando con la misma contraseña.
  return { ...abierto, llave: { llave, sal: leido.sal, n, r, p } };
}

/** Abre un `.cartera` con una llave ya derivada (p. ej. verificar un respaldo propio sin pedir la contraseña). */
export async function abrirRespaldoConLlave(
  cripto: CriptoRespaldo,
  archivo: Uint8Array,
  llave: Uint8Array,
  opciones: OpcionesApertura = {},
): Promise<RespaldoAbierto> {
  return descifrar(cripto, leerEncabezado(archivo, opciones), llave, opciones);
}
