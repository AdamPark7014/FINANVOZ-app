/**
 * E17 · Sincronización de gastos compartidos (`docs/05-MOTORES.md §E17`, M16): eventos de un grupo de dos
 * personas cifrados de extremo a extremo con XChaCha20-Poly1305, su fusión por `id` y la entrada de E12.2. No
 * toca red ni base: la app (`apps/movil/src/servicios/compartido.ts`) los publica, descarga y lleva al libro.
 */
export type { CriptoSincronizacion } from './cripto';
export {
  aadEvento,
  BYTES_ETIQUETA,
  BYTES_LLAVE_GRUPO,
  BYTES_NONCE,
  cifrarEvento,
  descifrarFila,
  ERROR_ILEGIBLE,
  LARGO_MAXIMO_BLOB,
  nuevaLlaveGrupo,
  type FilaCifrada,
} from './cifrado';
export {
  Autor,
  ContenidoEvento,
  CuerpoAnulado,
  CuerpoGasto,
  CuerpoPago,
  EventoCompartido,
  formaCanonica,
  MAX_DESCRIPCION,
  otroAutor,
  serializarContenido,
  uuid4,
  Uuid,
  Uuid4,
  type TipoEvento,
} from './eventos';
export { entradaBalance, eventosVigentes, fusionarEventos, idsAnulados, saldoGrupo } from './fusion';
export {
  aBase64Url,
  CODIGO_UNION,
  codificarQr,
  deBase64Url,
  leerQr,
  PREFIJO_QR,
  VERSION_QR,
  type DatosQr,
} from './qr';
