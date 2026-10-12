import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Escribe la exportación en la caché de la app y abre la hoja de compartir del sistema (`04 §6`): el archivo
 * nunca pasa por un servidor nuestro. Se reemplaza en cada exportación (nombre fijo por formato) para no
 * acumular copias en el teléfono.
 */
export async function compartirArchivo(opciones: {
  nombre: string;
  contenido: string;
  tipoMime: 'application/json' | 'text/csv';
  titulo: string;
}): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('compartir_no_disponible');
  const archivo = new File(Paths.cache, opciones.nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(opciones.contenido);
  await Sharing.shareAsync(archivo.uri, { mimeType: opciones.tipoMime, dialogTitle: opciones.titulo });
}
