import type { BaseAbierta, PuertoSqlite } from '../db/abrir';
import { CLAVE_LLAVE_BASE, type AlmacenSeguro } from '../db/llave';

/**
 * Llaves del almacén seguro que borra "Borrar todo". Hoy solo la de la base; la del respaldo (M9) y las de grupos
 * compartidos (M16) se suman aquí.
 */
export const LLAVES_ALMACEN: readonly string[] = [CLAVE_LLAVE_BASE];

/**
 * "Borrar todo" (derecho de cancelación, `04 §6`): cierra la base, destruye la llave en el almacén seguro (sin
 * llave, cualquier copia residual es ilegible) y elimina el archivo. Después la app arranca como recién
 * instalada: la siguiente apertura genera otra llave y una base vacía que vuelve a pedir el consentimiento.
 * Las preferencias (colchón, bloqueo, onboarding, consentimiento) viven en la base y se van con ella.
 */
export async function borrarTodo(opciones: {
  base: BaseAbierta | null;
  puerto: PuertoSqlite;
  almacen: AlmacenSeguro;
}): Promise<void> {
  opciones.base?.cerrar();
  for (const llave of LLAVES_ALMACEN) await opciones.almacen.borrar(llave);
  opciones.puerto.eliminarArchivo();
}
