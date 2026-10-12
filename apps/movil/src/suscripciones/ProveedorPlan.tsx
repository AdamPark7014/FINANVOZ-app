import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { obtenerPlan, sincronizarPlan, type EstadoTienda } from '../servicios';
import { useSesion } from '../sesion/ProveedorSesion';
import { reidentificarCompras } from './reidentificar';
import type { AdaptadorCompras } from './tipos';

export interface ValorPlan {
  /** `null` si esta build no tiene tienda (sin llave en producción, Expo Go): la cuenta es Gratis. */
  readonly compras: AdaptadorCompras | null;
  /** Abre la pantalla del plan (candados "· Plus"); `null` si no hay navegación (pruebas de una pantalla). */
  readonly abrirPlan: (() => void) | null;
  /**
   * Tras entrar con el correo de respaldo o borrar la cuenta de respaldo (cambia el usuario del proxy): las
   * compras pasan al usuario nuevo (pendiente 58). Nunca rechaza; sin tienda o sin red no hace nada.
   */
  readonly reidentificar: () => Promise<void>;
}

const sinTienda = async () => {};
const PlanContexto = createContext<ValorPlan>({ compras: null, abrirPlan: null, reidentificar: sinTienda });

/**
 * Tienda y navegación al plan para toda la app. Al montar, y cada vez que la tienda avisa un cambio, guarda el
 * plan en la base (`sincronizarPlan`) y refresca las vistas; asocia las compras al usuario anónimo del proxy.
 * Sin red se queda con lo último guardado (y su vencimiento).
 */
export function ProveedorPlan({
  compras,
  abrirPlan = null,
  children,
}: {
  compras: AdaptadorCompras | null;
  abrirPlan?: (() => void) | null;
  children: ReactNode;
}) {
  const { ctx, nube, refrescar } = useSesion();

  useEffect(() => {
    if (!compras) return;
    let vigente = true;
    // Un aviso de la tienda siempre refresca (el plan pudo vencer mientras la app estaba abierta); la lectura al
    // abrir solo si algo cambió.
    const guardar = (estado: EstadoTienda, siempre: boolean) => {
      if (!vigente) return;
      try {
        const antes = JSON.stringify(obtenerPlan(ctx));
        if (JSON.stringify(sincronizarPlan(ctx, estado)) !== antes || siempre) refrescar();
      } catch {
        // Base cerrada (borrar todo): se sincroniza en la siguiente sesión.
      }
    };
    const leer = () =>
      compras.estado().then(
        (e) => guardar(e, false),
        () => {
          // Sin red o tienda caída: se queda lo guardado.
        },
      );
    const identificar = () => {
      const pedir = nube?.usuarioId;
      if (!pedir) return Promise.resolve();
      return pedir()
        .then((id) => (id ? compras.identificar(id) : undefined))
        .catch(() => undefined);
    };
    const dejar = compras.alCambiar((e) => guardar(e, true));
    void identificar().then(leer);
    const dejarRed = nube?.conectividad.alReconectar(() => void identificar().then(leer));
    return () => {
      vigente = false;
      dejar();
      dejarRed?.();
    };
  }, [compras, ctx, nube, refrescar]);

  const reidentificar = useCallback(async () => {
    if (!compras || !nube?.usuarioId) return;
    try {
      await reidentificarCompras(compras, await nube.usuarioId(), ctx);
      refrescar();
    } catch {
      // Sin red o tienda caída: al abrir la app y al reconectar se vuelve a identificar.
    }
  }, [compras, nube, ctx, refrescar]);

  const valor = useMemo(() => ({ compras, abrirPlan, reidentificar }), [compras, abrirPlan, reidentificar]);
  return <PlanContexto.Provider value={valor}>{children}</PlanContexto.Provider>;
}

export function usePlanTienda(): ValorPlan {
  return useContext(PlanContexto);
}
