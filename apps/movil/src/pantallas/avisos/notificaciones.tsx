import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  horaDispositivo,
  puertoEnMemoria,
  sincronizarAvisoRespaldo,
  sincronizarAvisosTarjetas,
  sincronizarRecordatoriosCobro,
  type PuertoNotificaciones,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';

/** Permiso de avisos del teléfono en palabras de la app. */
export type PermisoAvisos = 'concedido' | 'denegado' | 'sin_preguntar';

/**
 * Notificaciones locales (`02 §13`): el puerto donde se programan y el permiso del sistema. La raíz pasa las de
 * `expo-notifications` (`./expo.ts`); las pruebas, `notificacionesEnMemoria`. Nada sale del teléfono.
 */
export interface Notificaciones {
  readonly puerto: PuertoNotificaciones;
  permiso(): Promise<PermisoAvisos>;
  pedirPermiso(): Promise<PermisoAvisos>;
  /** Abre los ajustes del sistema cuando el permiso ya se negó. */
  abrirAjustesSistema?: () => void;
}

const NotificacionesContexto = createContext<Notificaciones | null>(null);

export function ProveedorNotificaciones({
  notificaciones,
  children,
}: {
  notificaciones: Notificaciones | null;
  children: ReactNode;
}) {
  return <NotificacionesContexto.Provider value={notificaciones}>{children}</NotificacionesContexto.Provider>;
}

/** `null` sin proveedor: las pantallas funcionan igual, solo no programan avisos. */
export function useNotificaciones(): Notificaciones | null {
  return useContext(NotificacionesContexto);
}

/** Para pruebas: puerto en memoria y permiso controlable. */
export function notificacionesEnMemoria(inicial: PermisoAvisos = 'concedido') {
  const puerto = puertoEnMemoria();
  let permiso: PermisoAvisos = inicial;
  let pedidos = 0;
  return {
    puerto,
    permiso: async () => permiso,
    pedirPermiso: async (): Promise<PermisoAvisos> => {
      pedidos += 1;
      permiso = 'concedido';
      return permiso;
    },
    fijarPermiso: (p: PermisoAvisos) => {
      permiso = p;
    },
    /** Cuántas veces se mostró el diálogo del sistema. */
    vecesPedido: () => pedidos,
  } satisfies Notificaciones & Record<string, unknown>;
}

/**
 * Mantiene los avisos de tarjetas programados (CA-M4-04): al abrir la app y después de cada escritura (`version`
 * sube con cada cambio de tarjeta, pago, corte o preferencia). La sincronización es idempotente; si llega otro
 * cambio mientras corre, se repite una vez al terminar. Sin permiso no programa nada.
 */
export function SincronizarAvisosTarjetas({ hora = horaDispositivo }: { hora?: () => string }) {
  const { ctx, version } = useSesion();
  const notificaciones = useNotificaciones();
  const estado = useRef<{ corriendo: boolean; pendiente: boolean }>({ corriendo: false, pendiente: false });

  useEffect(() => {
    if (!notificaciones) return;
    const correr = async () => {
      if (estado.current.corriendo) {
        estado.current.pendiente = true;
        return;
      }
      estado.current.corriendo = true;
      try {
        do {
          estado.current.pendiente = false;
          if ((await notificaciones.permiso()) !== 'concedido') break;
          await sincronizarAvisosTarjetas(ctx, notificaciones.puerto, hora());
          // Recordatorios de cobro (RF-PER-03): se cancelan solos cuando la persona ya te pagó.
          await sincronizarRecordatoriosCobro(ctx, notificaciones.puerto, hora());
          // "Respaldo pendiente" (M9): a los 14 días sin respaldo y uno por semana; un respaldo nuevo lo recorre.
          await sincronizarAvisoRespaldo(ctx, notificaciones.puerto, hora());
        } while (estado.current.pendiente);
      } catch {
        // Sin detalle (regla 9): se reintenta en la siguiente escritura o al abrir la app.
      } finally {
        estado.current.corriendo = false;
      }
    };
    void correr();
  }, [ctx, version, notificaciones, hora]);

  return null;
}
