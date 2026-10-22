import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { autenticadorExpo, type Autenticador, type ErrorAutenticacion } from './autenticador';
import { transicionBloqueo, type EstadoApp } from './bloqueo';

export interface FuenteEstadoApp {
  suscribir(alCambiar: (estado: EstadoApp) => void): () => void;
}

export const estadoAppRN: FuenteEstadoApp = {
  suscribir(alCambiar) {
    const sub = AppState.addEventListener('change', (e) => alCambiar(e));
    return () => sub.remove();
  },
};

export interface OpcionesBloqueo {
  /** El bloqueo está activado en Ajustes. */
  activo: boolean;
  /** Bloquear al abrir la app en frío (por omisión, sí). */
  bloquearAlIniciar?: boolean;
  /** Pedir la autenticación en cuanto se bloquea (por omisión, sí). */
  solicitarAlBloquear?: boolean;
  esperaMs?: number;
  /** Reloj en ms; por omisión `Date.now`. */
  reloj?: () => number;
  autenticador?: Autenticador;
  estadoApp?: FuenteEstadoApp;
  /**
   * El teléfono ya no tiene ni biometría ni código (se lo quitaron después de encender el bloqueo): la app entra
   * sin pedir nada y avisa aquí para que la raíz apague el bloqueo en Ajustes.
   */
  alSinSeguridad?: () => void;
}

export interface Bloqueo {
  /** Mientras sea `true`, la app muestra solo la cortina de bloqueo. */
  bloqueado: boolean;
  autenticando: boolean;
  error: ErrorAutenticacion | null;
  /** Pide biometría o PIN; `true` si se desbloqueó. */
  desbloquear: () => Promise<boolean>;
  /**
   * Se desbloqueó sin autenticar porque el teléfono no tiene biometría ni código: sin eso el sistema nunca
   * autentica y la cortina no se podría quitar. La raíz debe apagar el bloqueo y explicarlo.
   */
  sinSeguridad: boolean;
}

/**
 * Bloqueo con biometría o PIN del sistema (RF-CFG-03, CA-M2-11): se pide al abrir la app y al
 * volver después de ≥ 1 min en segundo plano. Las salidas mientras el aviso del sistema está
 * abierto (la pantalla del PIN es otra actividad en Android) no cuentan.
 */
export function useBloqueo({
  activo,
  bloquearAlIniciar = true,
  solicitarAlBloquear = true,
  esperaMs,
  reloj = Date.now,
  autenticador = autenticadorExpo,
  estadoApp = estadoAppRN,
  alSinSeguridad,
}: OpcionesBloqueo): Bloqueo {
  const [bloqueado, setBloqueado] = useState(() => activo && bloquearAlIniciar);
  const [autenticando, setAutenticando] = useState(false);
  const [error, setError] = useState<ErrorAutenticacion | null>(null);
  const [sinSeguridad, setSinSeguridad] = useState(false);
  const avisarSinSeguridad = useRef(alSinSeguridad);
  useEffect(() => {
    avisarSinSeguridad.current = alSinSeguridad;
  });

  const seguimiento = useRef({ bloqueado, salioEn: null as number | null });
  const enCurso = useRef(false);

  const desbloquear = useCallback(async () => {
    if (enCurso.current) return false;
    enCurso.current = true;
    setAutenticando(true);
    setError(null);
    try {
      const r = await autenticador.autenticar();
      if (r.exito) {
        seguimiento.current = { bloqueado: false, salioEn: null };
        setBloqueado(false);
        return true;
      }
      if (r.error === 'sin_seguridad') {
        // Se vuelve a preguntar al sistema: solo si de verdad no hay biometría ni código se entra sin pedir nada
        // (un error suelto no basta para saltarse el bloqueo).
        const hay = await autenticador.disponible().catch(() => true);
        if (!hay) {
          seguimiento.current = { bloqueado: false, salioEn: null };
          setBloqueado(false);
          setSinSeguridad(true);
          avisarSinSeguridad.current?.();
          return true;
        }
      }
      setError(r.error);
      return false;
    } catch {
      setError('fallo');
      return false;
    } finally {
      enCurso.current = false;
      setAutenticando(false);
    }
  }, [autenticador]);

  const config = useRef({ activo, esperaMs, reloj, solicitarAlBloquear, desbloquear });
  useEffect(() => {
    config.current = { activo, esperaMs, reloj, solicitarAlBloquear, desbloquear };
  });

  useEffect(() => {
    return estadoApp.suscribir((siguiente) => {
      if (enCurso.current) return;
      const c = config.current;
      const antes = seguimiento.current;
      const despues = transicionBloqueo(antes, siguiente, {
        activo: c.activo,
        ahora: c.reloj(),
        ...(c.esperaMs === undefined ? {} : { esperaMs: c.esperaMs }),
      });
      seguimiento.current = despues;
      if (despues.bloqueado && !antes.bloqueado) {
        setBloqueado(true);
        if (c.solicitarAlBloquear) void c.desbloquear();
      }
    });
  }, [estadoApp]);

  // Al abrir en frío con bloqueo: pide autenticación una vez.
  const pedido = useRef(false);
  useEffect(() => {
    if (pedido.current || !bloqueado || !solicitarAlBloquear) return;
    pedido.current = true;
    void desbloquear();
  }, [bloqueado, solicitarAlBloquear, desbloquear]);

  // Si apagan el bloqueo, deja de aplicar sin esperar autenticación.
  const efectivo = activo && bloqueado;
  return { bloqueado: efectivo, autenticando, error: efectivo ? error : null, desbloquear, sinSeguridad };
}
