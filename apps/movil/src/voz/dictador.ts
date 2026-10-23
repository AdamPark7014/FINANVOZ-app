import { createContext, useContext } from 'react';
import type { MotorDictado } from './motor';

/**
 * El reconocedor de la app y el registro de qué micrófono lo está usando. Vive aparte de `ProveedorDictado` para
 * que `useMicrofono` lo lea sin cerrar un ciclo (el proveedor monta `BotonDictarCampo`, que usa `useMicrofono`).
 */
export interface Dictador {
  motor: MotorDictado;
  /**
   * El micrófono `id` va a escuchar: calla antes al que estuviera escuchando (con su `soltar`, que aborta el
   * reconocedor) para que dos dictados no reciban el mismo resultado. Devuelve `true` si calló a otro.
   */
  tomar(id: string, soltar: () => void): boolean;
  /** El micrófono `id` terminó (o se desmontó); si era el que escuchaba, ya no hay ninguno. */
  liberar(id: string): void;
}

/** Sin proveedor no hay registro: cada micrófono usa su reconocedor sin callar a los demás (pruebas sueltas). */
export const ContextoDictado = createContext<Dictador | null>(null);

/** El dictador de la app, o `null` si no hay `ProveedorDictado` arriba. */
export function useDictador(): Dictador | null {
  return useContext(ContextoDictado);
}
