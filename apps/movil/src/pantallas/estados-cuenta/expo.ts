/**
 * El PDF del estado de cuenta desde el selector del sistema (`07 §8`: "hoja de compartir o selector de archivos").
 * Es lo único de esta pantalla que toca módulos nativos; las pruebas inyectan un `extraer` falso.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/** URI de la copia en la caché del PDF elegido, o `null` si la persona canceló. */
export async function elegirPdf(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled) return null;
  return r.assets[0]?.uri ?? null;
}

/** Borra la copia de la caché al salir (el estado de cuenta no se queda en el teléfono). */
export function borrarCopia(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // La caché se limpia sola si no se pudo borrar.
  }
}
