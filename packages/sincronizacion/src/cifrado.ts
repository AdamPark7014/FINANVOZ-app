import { strFromU8, strToU8 } from 'fflate';
import { ErrorDominio } from '@cartera/core';
import { aBase64, deBase64 } from '@cartera/respaldo';
import type { CriptoSincronizacion } from './cripto';
import { Autor, ContenidoEvento, EventoCompartido, serializarContenido, Uuid, Uuid4 } from './eventos';

/** Llave simétrica del grupo: 32 bytes aleatorios (E17). */
export const BYTES_LLAVE_GRUPO = 32;
/** Nonce de XChaCha20-Poly1305: 24 bytes aleatorios por evento. */
export const BYTES_NONCE = 24;
export const BYTES_ETIQUETA = 16;
/** Tope del blob en base64 (un evento pesa unos cientos de bytes; el servidor aplica el mismo). */
export const LARGO_MAXIMO_BLOB = 4096;

/** Fila del servidor (`03 §5.10`): en claro solo `grupo_id`, `id` y `autor`; lo demás va en `blob`. */
export interface FilaCifrada {
  readonly grupo_id: string;
  readonly id: string;
  readonly autor: Autor;
  /** `base64(nonce ‖ texto cifrado ‖ etiqueta)` del JSON `{tipo, creado_en, cuerpo}`. */
  readonly blob: string;
}

export const ERROR_ILEGIBLE = 'evento_ilegible';

const ilegible = () => new ErrorDominio(ERROR_ILEGIBLE, 'el evento compartido no se pudo leer');

/** AAD = bytes UTF-8 de `grupo_id|id|autor`: el servidor no puede mover un blob a otro grupo, id o autor. */
export function aadEvento(grupoId: string, id: string, autor: Autor): Uint8Array {
  return strToU8(`${grupoId}|${id}|${autor}`);
}

/** Llave nueva del grupo. Una llave nunca se reutiliza: cada grupo nuevo genera la suya (E17 paso 5). */
export function nuevaLlaveGrupo(aleatorio: (n: number) => Uint8Array): Uint8Array {
  const llave = aleatorio(BYTES_LLAVE_GRUPO);
  if (llave.length !== BYTES_LLAVE_GRUPO) throw new ErrorDominio('llave_grupo_invalida', 'llave corta');
  return llave;
}

function exigirLlave(llave: Uint8Array): void {
  if (llave.length !== BYTES_LLAVE_GRUPO) throw new ErrorDominio('llave_grupo_invalida', 'llave inválida');
}

/**
 * Cifra un evento ya validado. `nonce` solo lo fija el vector de conocimiento; en uso normal se genera aleatorio
 * en cada llamada.
 */
export async function cifrarEvento(
  cripto: CriptoSincronizacion,
  llave: Uint8Array,
  evento: EventoCompartido,
  opciones: { nonce?: Uint8Array } = {},
): Promise<FilaCifrada> {
  exigirLlave(llave);
  const e = EventoCompartido.parse(evento);
  const nonce = opciones.nonce ?? cripto.aleatorio(BYTES_NONCE);
  if (nonce.length !== BYTES_NONCE) throw new ErrorDominio('nonce_invalido', 'nonce de 24 bytes');
  const cifrado = await cripto.xchacha20poly1305Cifrar(
    llave,
    nonce,
    strToU8(serializarContenido(e)),
    aadEvento(e.grupo_id, e.id, e.autor),
  );
  const unido = new Uint8Array(nonce.length + cifrado.length);
  unido.set(nonce, 0);
  unido.set(cifrado, nonce.length);
  return { grupo_id: e.grupo_id, id: e.id, autor: e.autor, blob: aBase64(unido) };
}

/**
 * Descifra una fila del servidor y arma el evento con los campos en claro y los del blob. Llave equivocada, blob
 * alterado o movido a otro grupo, id o autor, y contenido fuera del esquema fallan igual: `evento_ilegible`.
 */
export async function descifrarFila(
  cripto: CriptoSincronizacion,
  llave: Uint8Array,
  fila: FilaCifrada,
): Promise<EventoCompartido> {
  exigirLlave(llave);
  const claro = { grupo_id: Uuid, id: Uuid4, autor: Autor };
  if (
    !claro.grupo_id.safeParse(fila.grupo_id).success ||
    !claro.id.safeParse(fila.id).success ||
    !claro.autor.safeParse(fila.autor).success ||
    typeof fila.blob !== 'string' ||
    fila.blob.length > LARGO_MAXIMO_BLOB
  )
    throw ilegible();
  const bytes = deBase64(fila.blob);
  if (!bytes || bytes.length < BYTES_NONCE + BYTES_ETIQUETA) throw ilegible();
  let texto: string;
  try {
    const plano = await cripto.xchacha20poly1305Descifrar(
      llave,
      bytes.subarray(0, BYTES_NONCE),
      bytes.subarray(BYTES_NONCE),
      aadEvento(fila.grupo_id, fila.id, fila.autor),
    );
    texto = strFromU8(plano);
  } catch {
    throw ilegible();
  }
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw ilegible();
  }
  const contenido = ContenidoEvento.safeParse(crudo);
  if (!contenido.success) throw ilegible();
  const evento = EventoCompartido.safeParse({
    id: fila.id,
    grupo_id: fila.grupo_id,
    autor: fila.autor,
    ...contenido.data,
  });
  if (!evento.success) throw ilegible();
  return evento.data;
}
