import { estadisticasActivas, idAnonimoAnalitica } from '../privacidad/estadisticas';
import type { Contexto } from '../servicios/contexto';
import { PROPIEDADES_TECNICAS, validarEvento, type EventoAnalitica } from './eventos';

/** Lo que el adaptador entrega al proveedor (PostHog en la app, un arreglo en las pruebas). */
export interface EnvioAnalitica {
  readonly evento: string;
  readonly idAnonimo: string;
  /** ISO 8601 UTC. */
  readonly instante: string;
  readonly propiedades: Readonly<Record<string, unknown>>;
}

export type TransporteAnalitica = (envio: EnvioAnalitica) => Promise<void>;

export interface Analitica {
  /** Nunca lanza: si algo falla, el evento se pierde en silencio (y sin registrar su contenido). */
  registrar(ctx: Contexto, evento: EventoAnalitica): void;
}

/** Analítica que no envía nada: builds sin llave de PostHog y pruebas de pantallas. */
export const ANALITICA_APAGADA: Analitica = { registrar: () => {} };

/**
 * Cliente de analítica (`03 §8`): con el opt-in apagado no hace nada; con el opt-in encendido valida contra la
 * lista blanca y entrega al transporte solo el nombre, un identificador anónimo, la hora y las propiedades
 * permitidas más las técnicas fijas.
 */
export function crearAnalitica(opciones: {
  transporte: TransporteAnalitica;
  aleatorio: (n: number) => Uint8Array;
  /** Ids de banco del catálogo de plantillas (para el evento `captura`). */
  bancosPermitidos: ReadonlySet<string>;
}): Analitica {
  const { transporte, aleatorio, bancosPermitidos } = opciones;
  return {
    registrar(ctx, evento) {
      try {
        if (!estadisticasActivas(ctx)) return;
        const limpio = validarEvento(evento, bancosPermitidos);
        if (!limpio) return;
        const envio: EnvioAnalitica = {
          evento: limpio.nombre,
          idAnonimo: idAnonimoAnalitica(ctx, aleatorio),
          instante: new Date(ctx.reloj.ahora()).toISOString(),
          propiedades: { ...limpio.propiedades, ...PROPIEDADES_TECNICAS },
        };
        transporte(envio).catch(() => {
          // Sin reintentos ni registro: la analítica es opcional y el error podría llevar la petición.
        });
      } catch {
        // Ídem: nunca rompe la pantalla que la llama.
      }
    },
  };
}
