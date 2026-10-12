import { aBase64, deBase64 } from '@cartera/respaldo';
import { BYTES_LLAVE_GRUPO } from './cifrado';
import { Uuid } from './eventos';

/**
 * Contenido del código QR de E17: la llave del grupo y un código de unión de un solo uso, que la otra persona
 * escanea en persona. Ningún nombre ni dato financiero viaja en el QR. Formato (texto, modo byte):
 *
 *     FINANVOZ-PAREJA:1:<grupo_id>:<codigo_union>:<llave en base64url sin relleno>
 *
 * El código de unión lo emite el servidor (`/compartido/grupos` o `/compartido/codigo`): 16 bytes aleatorios en
 * base64url (22 caracteres); el servidor solo guarda su hash y lo borra al usarse.
 */
export const PREFIJO_QR = 'FINANVOZ-PAREJA';
export const VERSION_QR = 1;
export const CODIGO_UNION = /^[A-Za-z0-9_-]{22}$/;

export interface DatosQr {
  readonly grupoId: string;
  readonly codigoUnion: string;
  readonly llave: Uint8Array;
}

/** base64url sin relleno (RFC 4648 §5). */
export function aBase64Url(bytes: Uint8Array): string {
  return aBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverso estricto de `aBase64Url`; `null` si no es base64url canónico. */
export function deBase64Url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) return null;
  const estandar = texto.replace(/-/g, '+').replace(/_/g, '/');
  return deBase64(estandar.padEnd(Math.ceil(estandar.length / 4) * 4, '='));
}

export function codificarQr(datos: DatosQr): string {
  if (!Uuid.safeParse(datos.grupoId).success) throw new Error('grupo_id inválido');
  if (!CODIGO_UNION.test(datos.codigoUnion)) throw new Error('código de unión inválido');
  if (datos.llave.length !== BYTES_LLAVE_GRUPO) throw new Error('llave inválida');
  return [PREFIJO_QR, VERSION_QR, datos.grupoId, datos.codigoUnion, aBase64Url(datos.llave)].join(':');
}

/** Lee un QR escaneado; `null` si no es un código de Finanvoz válido (cualquier otro QR se ignora). */
export function leerQr(texto: string): DatosQr | null {
  if (typeof texto !== 'string' || texto.length > 200) return null;
  const partes = texto.trim().split(':');
  if (partes.length !== 5) return null;
  const [prefijo, version, grupoId = '', codigoUnion = '', llaveTexto = ''] = partes;
  if (prefijo !== PREFIJO_QR || version !== String(VERSION_QR)) return null;
  if (!Uuid.safeParse(grupoId).success || !CODIGO_UNION.test(codigoUnion)) return null;
  const llave = deBase64Url(llaveTexto);
  if (!llave || llave.length !== BYTES_LLAVE_GRUPO || aBase64Url(llave) !== llaveTexto) return null;
  return { grupoId, codigoUnion, llave };
}
