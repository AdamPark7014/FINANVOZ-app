import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { obtenerPlan, sincronizarPlan, type EstadoTienda } from '../servicios';
import { fijarPlusDePrueba } from '../servicios/plan';
import { useSesion } from '../sesion/ProveedorSesion';
import { modoPlusDePrueba } from './config';
import { plusSinTiendaDeLaBuild } from './build';
import { reidentificarCompras } from './reidentificar';
import type { AdaptadorCompras } from './tipos';

export interface ValorPlan {
  /**
   * `null` si esta build no tiene tienda (iPhone, sin llave en producción, Expo Go): la cuenta es Gratis, salvo en
   * «Plus de prueba» (`plusDePrueba`).
   */
  readonly compras: AdaptadorCompras | null;
  /** Build de prueba sin tienda con `EXPO_PUBLIC_PLUS_SIN_TIENDA=1`: todo Plus, sin cobro ni ofertas. */
  readonly plusDePrueba: boolean;
  /** Abre la pantalla del plan (candados "· Plus"); `null` si no hay navegación (pruebas de una pantalla). */
  readonly abrirPlan: (() => void) | null;
  /**
   * Tras entrar con el correo de respaldo o borrar la cuenta de respaldo (cambia el usuario del proxy): las
   * compras pasan al usuario nuevo (pendiente 58). Nunca rechaza; sin tienda o sin red no hace nada.
   */
  readonly reidentificar: () => Promise<void>;
}

const sinTienda = async () => {};
const PlanContexto = createContext<ValorPlan>({
  compras: null,
  plusDePrueba: false,
  abrirPlan: null,
  reidentificar: sinTienda,
});

/**
 * Tienda y navegación al plan para toda la app. Al montar, y cada vez que la tienda avisa un cambio, guarda el
 * plan en la base (`sincronizarPlan`) y refresca las vistas; asocia las compras al usuario anónimo del proxy.
 * Sin red se queda con lo último guardado (y su vencimiento). Sin tienda y con `plusSinTienda` (por omisión, lo
 * que diga la build) marca la sesión como «Plus de prueba».
 */
export function ProveedorPlan({
  compras,
  abrirPlan = null,
  plusSinTienda = plusSinTiendaDeLaBuild(),
  children,
}: {
  compras: AdaptadorCompras | null;
  abrirPlan?: (() => void) | null;
  /** Solo pruebas: fija la variable de la build en vez de leer `extra.plusSinTienda`. */
  plusSinTienda?: boolean;
  children: ReactNode;
}) {
  const { ctx, nube, refrescar } = useSesion();
  const plusDePrueba = modoPlusDePrueba({ plusSinTienda, hayTienda: compras !== null });
  // En el render y no en un efecto: las pantallas hijas leen `funcionesPlan` en su primer render. Es idempotente y
  // depende solo de la build, que no cambia con la app abierta.
  fijarPlusDePrueba(ctx, plusDePrueba);

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

  const valor = useMemo(
    () => ({ compras, plusDePrueba, abrirPlan, reidentificar }),
    [compras, plusDePrueba, abrirPlan, reidentificar],
  );
  return <PlanContexto.Provider value={valor}>{children}</PlanContexto.Provider>;
}

export function usePlanTienda(): ValorPlan {
  return useContext(PlanContexto);
}
