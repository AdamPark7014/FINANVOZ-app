import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Contexto, NivelNube } from '../servicios';

/**
 * Contexto de servicios para las pantallas. La raíz abre la sesión (`servicios/sesion`) y la pasa aquí; las
 * pruebas pasan un `Contexto` armado con `db/node`. `version` sube cada vez que algo escribe en el libro para
 * que las pantallas vuelvan a leer sus vistas (Hoy, Movimientos, Cuentas).
 */
export interface ValorSesion {
  readonly ctx: Contexto;
  readonly version: number;
  /** Llamar después de cualquier escritura (registrar, deshacer, cubrir, ajustes). */
  readonly refrescar: () => void;
  /** Nivel 2 del intérprete; `null` sin configuración de Supabase (las frases quedan "por interpretar"). */
  readonly nube: NivelNube | null;
}

const SesionContexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({
  ctx,
  nube = null,
  children,
}: {
  ctx: Contexto;
  nube?: NivelNube | null;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const refrescar = useCallback(() => setVersion((v) => v + 1), []);
  const valor = useMemo(() => ({ ctx, version, refrescar, nube }), [ctx, version, refrescar, nube]);
  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(SesionContexto);
  if (!valor) throw new Error('useSesion fuera de ProveedorSesion');
  return valor;
}

/** Lee una vista de servicios y la vuelve a leer cuando cambia `version`. */
export function useVista<T>(leer: (ctx: Contexto) => T): T {
  const { ctx, version } = useSesion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` fuerza la relectura tras cada escritura
  return useMemo(() => leer(ctx), [ctx, version]);
}
