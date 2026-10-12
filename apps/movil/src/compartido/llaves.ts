import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import { aBase64, deBase64 } from '@cartera/respaldo';
import { BYTES_LLAVE_GRUPO, Uuid } from '@cartera/sincronizacion';
import type { AlmacenSeguro } from '../db/llave';

/**
 * Llaves de los grupos compartidos (E17) en el almacén seguro, con las mismas opciones que la de la base
 * (`04 §7`: sin autenticación, después del primer desbloqueo). Una sola entrada con todas, para que "Borrar todo"
 * la destruya sin tener que enumerar el almacén. Viajan dentro del respaldo cifrado (E16); nunca en la base, en
 * logs ni en la exportación en claro.
 */
export const CLAVE_LLAVES_COMPARTIDO = 'cartera.compartido.llaves.v1';

const Guardadas = z.strictObject({ v: z.literal(1), llaves: z.record(Uuid, z.string()) });

/** Llaves por grupo. Una entrada ilegible es un error (no se reemplaza sola: se perderían las llaves). */
export function leerLlavesGrupos(almacen: AlmacenSeguro): Map<string, Uint8Array> {
  const texto = almacen.obtener(CLAVE_LLAVES_COMPARTIDO);
  const mapa = new Map<string, Uint8Array>();
  if (texto === null) return mapa;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    crudo = null;
  }
  const r = Guardadas.safeParse(crudo);
  if (!r.success)
    throw new ErrorDominio('llaves_compartido_invalidas', 'las llaves guardadas no son válidas');
  for (const [grupo, b64] of Object.entries(r.data.llaves)) {
    const llave = deBase64(b64);
    if (!llave || llave.length !== BYTES_LLAVE_GRUPO)
      throw new ErrorDominio('llaves_compartido_invalidas', 'las llaves guardadas no son válidas');
    mapa.set(grupo, llave);
  }
  return mapa;
}

export function obtenerLlaveGrupo(almacen: AlmacenSeguro, grupoId: string): Uint8Array | null {
  return leerLlavesGrupos(almacen).get(grupoId) ?? null;
}

function escribir(almacen: AlmacenSeguro, mapa: Map<string, Uint8Array>): void {
  const llaves: Record<string, string> = {};
  for (const [grupo, llave] of [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    llaves[grupo] = aBase64(llave);
  }
  almacen.guardar(CLAVE_LLAVES_COMPARTIDO, JSON.stringify({ v: 1, llaves }));
}

export function guardarLlaveGrupo(almacen: AlmacenSeguro, grupoId: string, llave: Uint8Array): void {
  if (!Uuid.safeParse(grupoId).success || llave.length !== BYTES_LLAVE_GRUPO)
    throw new ErrorDominio('llave_grupo_invalida', 'llave de grupo inválida');
  const mapa = leerLlavesGrupos(almacen);
  mapa.set(grupoId, llave);
  escribir(almacen, mapa);
}

/** Borra la llave del grupo; si era la última, borra la entrada completa del almacén. */
export async function borrarLlaveGrupo(almacen: AlmacenSeguro, grupoId: string): Promise<void> {
  const mapa = leerLlavesGrupos(almacen);
  if (!mapa.delete(grupoId)) return;
  if (mapa.size === 0) await almacen.borrar(CLAVE_LLAVES_COMPARTIDO);
  else escribir(almacen, mapa);
}

/** Para el respaldo cifrado (E16): `{grupo_id: llave en base64}`. */
export function llavesParaRespaldo(almacen: AlmacenSeguro): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [grupo, llave] of leerLlavesGrupos(almacen)) salida[grupo] = aBase64(llave);
  return salida;
}

/** Restaura las llaves que traía un respaldo (las que ya están en este teléfono se conservan). */
export function restaurarLlaves(almacen: AlmacenSeguro, llaves: Record<string, string>): void {
  const mapa = leerLlavesGrupos(almacen);
  for (const [grupo, b64] of Object.entries(llaves)) {
    const llave = deBase64(b64);
    if (!Uuid.safeParse(grupo).success || !llave || llave.length !== BYTES_LLAVE_GRUPO)
      throw new ErrorDominio('respaldo_invalido', 'el respaldo trae una llave de grupo inválida');
    if (!mapa.has(grupo)) mapa.set(grupo, llave);
  }
  if (mapa.size > 0) escribir(almacen, mapa);
}
