import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type TipoMime = 'application/json' | 'text/csv';

/** iOS decide qué apps ofrece en la hoja de compartir por el UTI (Android usa el tipo MIME). */
export const UTI_POR_MIME: Record<TipoMime, string> = {
  'application/json': 'public.json',
  'text/csv': 'public.comma-separated-values-text',
};

/**
 * Escribe la exportación en la caché de la app y abre la hoja de compartir del sistema (`04 §6`): el archivo
 * nunca pasa por un servidor nuestro. Se reemplaza en cada exportación (nombre fijo por formato) para no
 * acumular copias en el teléfono. La promesa se cumple cuando la hoja se cierra (el sistema no dice si se guardó).
 */
export async function compartirArchivo(opciones: {
  nombre: string;
  contenido: string;
  tipoMime: TipoMime;
  titulo: string;
}): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('compartir_no_disponible');
  const archivo = new File(Paths.cache, opciones.nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(opciones.contenido);
  await Sharing.shareAsync(archivo.uri, {
    mimeType: opciones.tipoMime,
    UTI: UTI_POR_MIME[opciones.tipoMime],
    dialogTitle: opciones.titulo,
  });
}
