import type { CatalogoPlantillas } from '@cartera/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { registrarSenalesCaptura } from '../servicios';
import { useSesion } from '../sesion/ProveedorSesion';
import { catalogoApp } from './catalogo';
import { procesarColaCaptura, type ResultadoCola } from './ingesta';
import type { PuenteCaptura, Sha256Hex } from './tipos';

/**
 * Captura automática para las pantallas (`03 §5.2`): el puente del módulo nativo (`null` o no disponible sin él:
 * Expo Go, pruebas, iPhone), el catálogo de plantillas y `procesar`, que lee la cola, la ingiere y refresca.
 */
export interface ValorCaptura {
  /** Solo si el módulo nativo existe; si no, `null` y la captura aparece como no disponible. */
  readonly puente: PuenteCaptura | null;
  readonly catalogo: CatalogoPlantillas;
  /** Lee la cola nativa y la ingiere; `null` sin módulo o con una corrida en curso (se repite al terminar). */
  readonly procesar: () => Promise<ResultadoCola | null>;
  /** Permiso, apps bancarias instaladas y último evento del servicio (RF-CAP-07). */
  readonly leerSenales: () => Promise<void>;
}

const CapturaContexto = createContext<ValorCaptura | null>(null);

let sinCaptura: ValorCaptura | null = null;
function valorSinCaptura(): ValorCaptura {
  sinCaptura ??= {
    puente: null,
    catalogo: catalogoApp(),
    procesar: async () => null,
    leerSenales: async () => {},
  };
  return sinCaptura;
}

/**
 * Procesa la cola al montar, al volver a la app y con cada notificación que avisa el servicio. Nada se registra
 * en logs (regla 9): un error deja la cola sin confirmar y la siguiente corrida la vuelve a leer (huella).
 */
export function ProveedorCaptura({
  puente: puenteDado,
  sha256,
  depuracion,
  catalogo = catalogoApp(),
  children,
}: {
  puente: PuenteCaptura | null;
  sha256: Sha256Hex;
  /** Por omisión, lo que diga el módulo (build de depuración). */
  depuracion?: boolean;
  catalogo?: CatalogoPlantillas;
  children: ReactNode;
}) {
  const { ctx, refrescar } = useSesion();
  const puente = puenteDado?.disponible() ? puenteDado : null;
  const enDepuracion = depuracion ?? puente?.esDepuracion() ?? false;
  const enCurso = useRef(false);
  const pendiente = useRef(false);

  const procesar = useCallback(async (): Promise<ResultadoCola | null> => {
    if (!puente) return null;
    if (enCurso.current) {
      pendiente.current = true;
      return null;
    }
    enCurso.current = true;
    try {
      let r: ResultadoCola | null = null;
      do {
        pendiente.current = false;
        r = await procesarColaCaptura(ctx, puente, { catalogo, sha256, depuracion: enDepuracion });
        if (r.leidas > 0) refrescar();
      } while (pendiente.current);
      return r;
    } catch {
      return null;
    } finally {
      enCurso.current = false;
    }
  }, [ctx, puente, catalogo, sha256, enDepuracion, refrescar]);

  const leerSenales = useCallback(async () => {
    if (!puente) return;
    try {
      const [permiso, apps, ultimoEvento] = await Promise.all([
        puente.estadoPermiso(),
        puente.appsBancariasInstaladas(),
        puente.ultimoEvento(),
      ]);
      registrarSenalesCaptura(ctx, { permiso, appsInstaladas: apps.map((a) => a.paquete), ultimoEvento });
      refrescar();
    } catch {
      // Sin señales no se marca nada como inactivo ni activo.
    }
  }, [ctx, puente, refrescar]);

  useEffect(() => {
    if (!puente) return;
    void leerSenales().then(procesar);
    const cancelar = puente.suscribirse(() => void procesar());
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void leerSenales().then(procesar);
    });
    return () => {
      cancelar();
      app.remove();
    };
  }, [puente, procesar, leerSenales]);

  const valor = useMemo(
    () => ({ puente, catalogo, procesar, leerSenales }),
    [puente, catalogo, procesar, leerSenales],
  );
  return <CapturaContexto.Provider value={valor}>{children}</CapturaContexto.Provider>;
}

/** Fuera de `ProveedorCaptura` (pruebas de otras pantallas) la captura aparece como no disponible. */
export function useCaptura(): ValorCaptura {
  return useContext(CapturaContexto) ?? valorSinCaptura();
}
