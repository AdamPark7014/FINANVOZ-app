/** Lo que llega por la hoja de compartir, en lo que importa para decidir si es un PDF. */
export interface CargaCompartida {
  readonly mimeType?: string | null;
  readonly contentMimeType?: string | null;
  readonly originalName?: string | null;
  readonly contentUri?: string | null;
  readonly value?: string | null;
}

/**
 * ¿Es el PDF de un estado de cuenta (`07 §8`)? Por el tipo que declara la otra app o, si no lo dice (algunas
 * mandan `application/octet-stream`), por la extensión del nombre. Lo demás sigue siendo de facturas (M12).
 */
export function esPdfCompartido(c: CargaCompartida): boolean {
  const tipos = [c.mimeType, c.contentMimeType].map((t) => (t ?? '').toLowerCase());
  if (tipos.includes('application/pdf')) return true;
  const nombre = (c.originalName ?? c.contentUri ?? c.value ?? '').toLowerCase().split('?')[0] ?? '';
  return nombre.endsWith('.pdf');
}
