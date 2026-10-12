import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { ANALITICA_APAGADA, type Analitica } from '../analitica/cliente';
import type { EventoAnalitica } from '../analitica/eventos';
import { useSesion } from './ProveedorSesion';

/**
 * Analítica para las pantallas (`03 §8`). Sin proveedor (pruebas de pantallas) no se envía nada. Las pantallas
 * solo pueden pasar eventos de la lista blanca; el cliente vuelve a validarlos y respeta el opt-in.
 */
const AnaliticaContexto = createContext<Analitica>(ANALITICA_APAGADA);

export function ProveedorAnalitica({ analitica, children }: { analitica: Analitica; children: ReactNode }) {
  return <AnaliticaContexto.Provider value={analitica}>{children}</AnaliticaContexto.Provider>;
}

export function useAnalitica(): (evento: EventoAnalitica) => void {
  const analitica = useContext(AnaliticaContexto);
  const { ctx } = useSesion();
  return useCallback((evento: EventoAnalitica) => analitica.registrar(ctx, evento), [analitica, ctx]);
}
