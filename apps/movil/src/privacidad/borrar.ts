import type { BaseAbierta, PuertoSqlite } from '../db/abrir';
import { CLAVE_LLAVE_BASE, type AlmacenSeguro } from '../db/llave';
import { CLAVE_SESION_NUBE } from '../nube/sesion';
import { CLAVE_LLAVE_RESPALDO } from '../respaldo/llave';

/**
 * Llaves del almacén seguro que borra "Borrar todo": la de la base, los tokens de la sesión anónima del proxy
 * (M3) y la del respaldo (M9, `05 §E16`); las de grupos compartidos (M16) se suman aquí.
 */
export const LLAVES_ALMACEN: readonly string[] = [CLAVE_LLAVE_BASE, CLAVE_SESION_NUBE, CLAVE_LLAVE_RESPALDO];

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
