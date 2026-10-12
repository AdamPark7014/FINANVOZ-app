import { createContext, useContext, type ReactNode } from 'react';
import type { ArchivosRespaldo, DependenciasRespaldo, NubeRespaldo, RespaldoListo } from '../servicios';

/**
 * Acciones que solo la raíz puede hacer porque reemplazan la sesión completa: "Borrar todo" (cierra la base,
 * destruye la llave y arranca como recién instalada), restaurar un respaldo (M9) y, en builds de desarrollo,
 * cargar un escenario semilla.
 * La raíz (`app/_layout.tsx`) lo implementa con `servicios/sesion`; las pruebas pasan uno falso.
 */
export interface ControlApp {
  /** Borra todo y vuelve a abrir una base vacía: la app regresa al onboarding. */
  borrarTodo(): Promise<void>;
  /**
   * Respaldo cifrado (M9): dependencias nativas (cripto, almacén, archivos) y el reemplazo de la base por un
   * respaldo ya ensayado. Ausente en pruebas que no lo usan.
   */
  respaldo?: {
    readonly deps: DependenciasRespaldo;
    readonly archivos: ArchivosRespaldo;
    /** Borra todo, importa el respaldo en la base nueva y vuelve al inicio con "Listo: recuperé…". */
    restaurar(listo: RespaldoListo): Promise<void>;
    /**
     * Respaldo en la nube (cuenta de correo y bucket); `null` si la build no trae Supabase: Ajustes → Respaldo
     * solo ofrece archivos.
     */
    readonly nube?: NubeRespaldo | null;
    /** Registra o quita la tarea semanal en segundo plano (`respaldo/tarea.ts`). */
    programarAutomatico?: (activo: boolean) => Promise<void>;
  };
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
