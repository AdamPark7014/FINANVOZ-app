import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Tono = 'normal' | 'heroe';

const ContextoTono = createContext<{ tono: Tono; poner: (t: Tono) => void } | null>(null);

/** En el layout de las pestañas: la navegación de arriba se pinta del tono que pida la pantalla visible. */
export function ProveedorTonoNavegacion({ children }: { children: ReactNode }) {
  const [tono, poner] = useState<Tono>('normal');
  return <ContextoTono.Provider value={{ tono, poner }}>{children}</ContextoTono.Provider>;
}

export function useTonoNavegacion(): Tono {
  return useContext(ContextoTono)?.tono ?? 'normal';
}

/** Mientras `activo`, la navegación se funde con la placa de arriba (Inicio en reposo). */
export function useHeroeEnNavegacion(activo: boolean): void {
  const poner = useContext(ContextoTono)?.poner;
  useEffect(() => {
    if (!poner || !activo) return;
    poner('heroe');
    return () => poner('normal');
  }, [poner, activo]);
}
