import { createContext, useContext, type ReactNode } from 'react';
import type { DependenciasCompartido } from '../servicios';

const Contexto = createContext<DependenciasCompartido | null>(null);

/** Criptografía, almacén seguro y cliente de `/compartido/*` para las pantallas de `02 §27`. */
export function ProveedorCompartido({
  deps,
  children,
}: {
  deps: DependenciasCompartido;
  children: ReactNode;
}) {
  return <Contexto.Provider value={deps}>{children}</Contexto.Provider>;
}

export function useCompartido(): DependenciasCompartido {
  const deps = useContext(Contexto);
  if (!deps) throw new Error('falta ProveedorCompartido');
  return deps;
}
