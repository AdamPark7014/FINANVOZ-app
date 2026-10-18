import type { CatalogoPlantillas } from '@cartera/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { EventoAnalitica } from '../analitica/eventos';
import { registrarSenalesCaptura } from '../servicios';
import { useAnalitica } from '../sesion/ProveedorAnalitica';
import { useSesion } from '../sesion/ProveedorSesion';
import {
  actualizarPlantillasRemotas,
  plantillasActivas,
  type DependenciasPlantillas,
  type ResultadoActualizacion,
} from './actualizar-plantillas';
import { catalogoApp, fijarPlantillasRemotas } from './catalogo';
import { procesarColaCaptura, type ResultadoCola } from './ingesta';
import type { ArchivoRemoto } from './plantillas-remotas';
import { crearPlantillasRemotasExpo } from './plantillas-remotas-expo';
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

/** Las embebidas son la versión 1 (`07 §3.1`). */
const VERSION_EMBEBIDA = 1;

/**
 * `plantillas_remotas {version, resultado}` (`03 §8`): solo el código del resultado y la versión activa al
 * terminar; `null` si no hubo revisión ("no toca" o un build sin llaves).
 */
export function eventoPlantillasRemotas(
  r: ResultadoActualizacion,
  versionActiva: number,
): EventoAnalitica | null {
  switch (r.tipo) {
    case 'no_toca':
    case 'sin_llaves':
      return null;
    case 'aceptada':
      return { nombre: 'plantillas_remotas', propiedades: { version: r.version, resultado: 'aceptada' } };
    case 'rechazada':
      return { nombre: 'plantillas_remotas', propiedades: { version: versionActiva, resultado: r.motivo } };
    default:
      return { nombre: 'plantillas_remotas', propiedades: { version: versionActiva, resultado: r.tipo } };
  }
}

/** Avisa al módulo nativo sin dejar rechazos sueltos (un build anterior a M10 no tiene la función). */
function catalogoANativo(puente: PuenteCaptura | null, archivo: ArchivoRemoto | null): void {
  if (!puente) return;
  Promise.resolve()
    .then(() => puente.fijarCatalogoRemoto(archivo?.bancos ?? null))
    .catch(() => {});
}

/**
 * Procesa la cola al montar, al volver a la app y con cada notificación que avisa el servicio. Nada se registra
 * en logs (regla 9): un error deja la cola sin confirmar y la siguiente corrida la vuelve a leer (huella).
 *
 * Plantillas remotas (`07 §3.1`): al montar activa las ya verificadas y, una vez al día al abrir o volver a la
 * app, revisa si hay un archivo firmado más nuevo; el catálogo de JS y el del módulo nativo pasan a usarlo.
 */
export function ProveedorCaptura({
  puente: puenteDado,
  sha256,
  depuracion,
  catalogo: catalogoDado,
  plantillasRemotas,
  children,
}: {
  puente: PuenteCaptura | null;
  sha256: Sha256Hex;
  /** Por omisión, lo que diga el módulo (build de depuración). */
  depuracion?: boolean;
  /** Catálogo fijo (pruebas): sin él, el de la app con las plantillas remotas activas. */
  catalogo?: CatalogoPlantillas;
  /** Por omisión, la configuración del build (`null` sin llaves o sin proyecto: solo embebidas). */
  plantillasRemotas?: DependenciasPlantillas | null;
  children: ReactNode;
}) {
  const { ctx, refrescar } = useSesion();
  const registrarEvento = useAnalitica();
  const puente = puenteDado?.disponible() ? puenteDado : null;
  const enDepuracion = depuracion ?? puente?.esDepuracion() ?? false;
  const remotas = useMemo(
    () =>
      catalogoDado
        ? null
        : plantillasRemotas === undefined
          ? crearPlantillasRemotasExpo()
          : plantillasRemotas,
    [catalogoDado, plantillasRemotas],
  );
  const [catalogoRemoto, setCatalogoRemoto] = useState<CatalogoPlantillas | null>(null);
  const catalogo = catalogoDado ?? catalogoRemoto ?? catalogoApp();
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
        r = await procesarColaCaptura(ctx, puente, {
          catalogo,
          sha256,
          depuracion: enDepuracion,
          registrarEvento,
        });
        if (r.leidas > 0) refrescar();
      } while (pendiente.current);
      return r;
    } catch {
      return null;
    } finally {
      enCurso.current = false;
    }
  }, [ctx, puente, catalogo, sha256, enDepuracion, refrescar, registrarEvento]);

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
    if (catalogoDado) return;
    if (!remotas) {
      catalogoANativo(puente, null);
      return;
    }
    let vivo = true;
    let versionActiva = VERSION_EMBEBIDA;
    const aplicar = (archivo: ArchivoRemoto | null) => {
      fijarPlantillasRemotas(archivo);
      versionActiva = archivo?.version ?? VERSION_EMBEBIDA;
      if (vivo) setCatalogoRemoto(catalogoApp());
      catalogoANativo(puente, archivo);
    };
    const revisar = async () => {
      try {
        const r = await actualizarPlantillasRemotas(ctx, remotas);
        const evento = eventoPlantillasRemotas(r, versionActiva);
        if (evento) registrarEvento(evento);
        if (r.tipo === 'aceptada' && vivo) {
          aplicar(r.archivo);
          refrescar();
        }
      } catch {
        // Se conserva lo activo; mañana se vuelve a intentar.
      }
    };
    try {
      aplicar(plantillasActivas(ctx, remotas));
    } catch {
      aplicar(null);
    }
    void revisar();
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar();
    });
    return () => {
      vivo = false;
      app.remove();
    };
  }, [ctx, puente, remotas, catalogoDado, refrescar, registrarEvento]);

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
