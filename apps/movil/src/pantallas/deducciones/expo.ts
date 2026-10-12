/**
 * Archivos de facturas en el teléfono (M12, `02 §24`): el selector del sistema (`expo-document-picker`) y lo que
 * llega por la hoja de compartir (`expo-sharing`, `app/expo-sharing.tsx`), leído con `expo-file-system`. Es lo
 * único de deducciones que toca módulos nativos; las pruebas inyectan `ArchivosFacturas` falsos.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { ArchivoCfdi } from '../../servicios';
import type { ArchivosFacturas } from './archivos';

/** Un archivo más grande que esto no se lee (un ZIP del SAT con cientos de facturas pesa unos MB). */
const TAMANO_MAXIMO = 50 * 1024 * 1024;

/** Lee un archivo (ruta de la caché o `content://` de otra app) y, si lo copió el selector, lo borra. */
export async function leerArchivo(uri: string, nombre: string, borrar = false): Promise<ArchivoCfdi> {
  const archivo = new File(uri);
  try {
    // Uno demasiado grande se manda vacío: el servicio lo rechaza como "no es XML ni ZIP" sin leerlo.
    if (archivo.size > TAMANO_MAXIMO) return { nombre, bytes: new Uint8Array(0) };
    return { nombre, bytes: await archivo.bytes() };
  } finally {
    if (borrar) {
      try {
        archivo.delete();
      } catch {
        // La copia de la caché se limpia sola si no se pudo borrar.
      }
    }
  }
}

/** Nombre visible de un archivo compartido: el que dio la otra app o el final de la URI. */
export function nombreDeUri(uri: string, original: string | null | undefined): string {
  if (original) return original;
  const ultimo = uri.split('/').pop() ?? '';
  try {
    return decodeURIComponent(ultimo) || 'archivo';
  } catch {
    return ultimo || 'archivo';
  }
}

export const archivosFacturasExpo: ArchivosFacturas = {
  async elegir() {
    const r = await DocumentPicker.getDocumentAsync({
      // Los XML llegan como text/xml, application/xml u octet-stream según la app: se revisa el contenido.
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (r.canceled) return null;
    return Promise.all(r.assets.map((a) => leerArchivo(a.uri, a.name, true)));
  },
};
