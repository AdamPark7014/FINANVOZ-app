import { router, usePathname, type Href } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { destinoDeAviso } from '../../avisos/rutas';
import {
  horaDispositivo,
  obtenerConsentimiento,
  onboardingCompletado,
  puertoEnMemoria,
  sincronizarAvisoRespaldo,
  sincronizarAvisosTarjetas,
  sincronizarRecordatoriosCobro,
  type PuertoNotificaciones,
} from '../../servicios';
import { sincronizarAvisosOcurrencias } from '../../servicios/avisos-ocurrencias';
import { useControlAppOpcional } from '../../sesion/ControlApp';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';

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
  /** Toques a los avisos; sin esto, tocar uno solo abre la app. */
  respuestas?: RespuestasAvisos;
}

/** Un toque a un aviso: su id, la ruta que guardó al programarse y una clave distinta por toque. */
export interface RespuestaAviso {
  readonly id: string;
  readonly ruta: unknown;
  readonly clave: string;
}

export interface RespuestasAvisos {
  /** Toques con la app abierta o en segundo plano. Devuelve cómo dejar de escuchar. */
  suscribir(alTocar: (r: RespuestaAviso) => void): () => void;
  /** El toque que abrió la app en frío (llega antes de montar el oyente). */
  ultima(): Promise<RespuestaAviso | null>;
  /** Para no volver a abrir la misma pantalla si la app se vuelve a montar. */
  olvidarUltima?(): void;
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

let instanciasEnMemoria = 0;

/** Para pruebas: puerto en memoria, permiso controlable y toques simulados. */
export function notificacionesEnMemoria(inicial: PermisoAvisos = 'concedido') {
  const puerto = puertoEnMemoria();
  let permiso: PermisoAvisos = inicial;
  let pedidos = 0;
  const oyentes = new Set<(r: RespuestaAviso) => void>();
  let ultima: RespuestaAviso | null = null;
  let toques = 0;
  const instancia = (instanciasEnMemoria += 1);
  const respuesta = (id: string, ruta?: string): RespuestaAviso => {
    toques += 1;
    return { id, ruta, clave: `${id}@${instancia}.${toques}` };
  };
  return {
    puerto,
    respuestas: {
      suscribir: (alTocar: (r: RespuestaAviso) => void) => {
        oyentes.add(alTocar);
        return () => oyentes.delete(alTocar);
      },
      ultima: async () => ultima,
      olvidarUltima: () => {
        ultima = null;
      },
    },
    /** Toca un aviso con la app abierta o en segundo plano (`ruta`: la guardada en el aviso, si hay). */
    tocar: (id: string, ruta?: string) => {
      const r = respuesta(id, ruta);
      ultima = r;
      for (const o of oyentes) o(r);
    },
    /** La app se abre en frío desde el aviso `id`. */
    abrirDesde: (id: string, ruta?: string) => {
      ultima = respuesta(id, ruta);
    },
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
  // `null` = la build no trae respaldo en la nube; ausente (pruebas sueltas) se trata como disponible.
  const conNube = useControlAppOpcional()?.respaldo?.nube !== null;
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
          await sincronizarAvisoRespaldo(ctx, notificaciones.puerto, hora(), { conNube });
          // Aportación de tanda, compromiso sin cubrir e ingreso que no llegó: se cancelan al resolverse.
          await sincronizarAvisosOcurrencias(ctx, notificaciones.puerto, hora());
        } while (estado.current.pendiente);
      } catch {
        // Sin detalle (regla 9): se reintenta en la siguiente escritura o al abrir la app.
      } finally {
        estado.current.corriendo = false;
      }
    };
    void correr();
  }, [ctx, version, notificaciones, hora, conNube]);

  // Montado aquí porque este componente ya vive en la raíz, dentro de la sesión y junto a la navegación.
  return <AbrirAvisoTocado />;
}

/** Toques ya atendidos en este proceso (el mismo toque puede llegar por el oyente y como "último"). */
const toquesAtendidos = new Set<string>();

const navegarConRouter = (ruta: string) => router.navigate(ruta as Href);

/**
 * Tocar un aviso abre su pantalla (`rutas.ts`): con la app abierta o en segundo plano (oyente) y al abrirla en
 * frío desde el aviso (último toque). Navega debajo de la cortina de bloqueo, como el widget al abrir Hoy: con el
 * bloqueo activo la pantalla queda tapada hasta autenticarse. Sin onboarding completo no navega (lo decide
 * `app/index.tsx`).
 */
export function AbrirAvisoTocado({ navegar = navegarConRouter }: { navegar?: (ruta: string) => void }) {
  const respuestas = useNotificaciones()?.respuestas;
  const listo = useVista((ctx) => obtenerConsentimiento(ctx) !== null && onboardingCompletado(ctx));
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    if (!respuestas) return;
    let vigente = true;
    const atender = (r: RespuestaAviso) => {
      if (!vigente || toquesAtendidos.has(r.clave)) return;
      toquesAtendidos.add(r.clave);
      setDestino(destinoDeAviso(r));
    };
    const dejar = respuestas.suscribir(atender);
    respuestas
      .ultima()
      .then((r) => {
        if (!r) return;
        atender(r);
        respuestas.olvidarUltima?.();
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
      dejar();
    };
  }, [respuestas]);

  if (destino === null) return null;
  return (
    <NavegarAlAviso key={destino} destino={destino} listo={listo} navegar={navegar} alTerminar={setDestino} />
  );
}

/** Espera a que la raíz deje "/" (en frío, `app/index.tsx` todavía decide entre onboarding y Hoy) y navega. */
function NavegarAlAviso({
  destino,
  listo,
  navegar,
  alTerminar,
}: {
  destino: string;
  listo: boolean;
  navegar: (ruta: string) => void;
  alTerminar: (siguiente: null) => void;
}) {
  const ruta = usePathname();
  useEffect(() => {
    if (ruta === '' || ruta === '/') return;
    if (listo && ruta !== destino) navegar(destino);
    alTerminar(null);
  }, [ruta, destino, listo, navegar, alTerminar]);
  return null;
}
