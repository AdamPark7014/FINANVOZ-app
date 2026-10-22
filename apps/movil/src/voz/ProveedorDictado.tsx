import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { MotorDictado } from './motor';

/**
 * Lee la cifra dicha en un campo de dinero ("ocho mil quinientos", "como 500"): centavos enteros y si la
 * persona la dio como aproximada; `null` si no hay una cifra clara. La inyecta la raíz (servicios, con el
 * intérprete), así `ui/` y `voz/` no dependen de `@cartera/nlu`.
 */
export type LectorMonto = (
  texto: string,
  o: { admiteCero: boolean },
) => { centavos: number; aproximado: boolean } | null;

export interface Dictador {
  motor: MotorDictado;
  leerMonto: LectorMonto;
  /**
   * El micrófono `id` va a escuchar: calla antes al que estuviera escuchando (con su `soltar`, que aborta el
   * reconocedor) para que dos dictados no reciban el mismo resultado. Devuelve `true` si calló a otro.
   */
  tomar(id: string, soltar: () => void): boolean;
  /** El micrófono `id` terminó (o se desmontó); si era el que escuchaba, ya no hay ninguno. */
  liberar(id: string): void;
}

/** Sin proveedor no hay micrófono en los campos (pruebas, pantallas sueltas). */
const ContextoDictado = createContext<Dictador | null>(null);

/** Un solo reconocedor para toda la app y el registro de qué micrófono lo está usando. */
export function ProveedorDictado({
  motor,
  leerMonto,
  children,
}: {
  motor: MotorDictado;
  leerMonto: LectorMonto;
  children: ReactNode;
}) {
  const actual = useRef<{ id: string; soltar: () => void } | null>(null);
  const valor = useMemo<Dictador>(
    () => ({
      motor,
      leerMonto,
      tomar(id, soltar) {
        const previo = actual.current;
        actual.current = { id, soltar };
        if (previo === null || previo.id === id) return false;
        previo.soltar();
        return true;
      },
      liberar(id) {
        if (actual.current?.id === id) actual.current = null;
      },
    }),
    [motor, leerMonto],
  );
  return <ContextoDictado.Provider value={valor}>{children}</ContextoDictado.Provider>;
}

/** El dictador de la app, o `null` si no hay `ProveedorDictado` arriba. */
export function useDictador(): Dictador | null {
  return useContext(ContextoDictado);
}
