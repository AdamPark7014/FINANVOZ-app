import type { ArchivoCfdi } from '../../servicios';

/** Selector de archivos de facturas (XML o ZIP). En el teléfono, `archivosFacturasExpo`; en pruebas, uno falso. */
export interface ArchivosFacturas {
  /** `null` si la persona cancela. */
  elegir(): Promise<ArchivoCfdi[] | null>;
}
