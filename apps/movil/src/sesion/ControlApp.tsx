import { createContext, useContext, type ReactNode } from 'react';

/**
 * Acciones que solo la raíz puede hacer porque reemplazan la sesión completa: "Borrar todo" (cierra la base,
 * destruye la llave y arranca como recién instalada) y, en builds de desarrollo, cargar un escenario semilla.
 * La raíz (`app/_layout.tsx`) lo implementa con `servicios/sesion`; las pruebas pasan uno falso.
 */
export interface ControlApp {
  /** Borra todo y vuelve a abrir una base vacía: la app regresa al onboarding. */
  borrarTodo(): Promise<void>;
  /** Solo `__DEV__`: borra todo y carga `fixtures/escenarios/<id>.json` con el reloj fijo en su `hoy`. */
  cargarEscenario?: (datos: unknown) => Promise<void>;
}

const ControlContexto = createContext<ControlApp | null>(null);

export function ProveedorControlApp({ control, children }: { control: ControlApp; children: ReactNode }) {
  return <ControlContexto.Provider value={control}>{children}</ControlContexto.Provider>;
}

export function useControlApp(): ControlApp {
  const valor = useContext(ControlContexto);
  if (!valor) throw new Error('useControlApp fuera de ProveedorControlApp');
  return valor;
}
