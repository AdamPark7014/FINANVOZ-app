// Un turno del modo explicar (06 §6, 03 §6): proveedor principal → si 5xx/429/red/tiempo, un intento con el
// alterno, ambos dentro del presupuesto total de la petición (`PRESUPUESTO_TOTAL_MS`). Sin validación del texto:
// las cifras las valida el teléfono contra los resultados de sus herramientas (regla 4). No registra nada:
// devuelve metadatos para el manejador (regla 9).
import { conTiempo, crearPresupuesto, type OpcionesTiempo } from '../nlu/interpretar.ts';
import { FallaProveedor, type NombreProveedor } from '../nlu/proveedores.ts';
import { contarResultados, LLAMADAS_MAXIMAS, type SalidaTurno, type SolicitudTurno } from './contrato.ts';
import type { AdaptadorTurno } from './proveedores.ts';

export interface OpcionesTurno extends OpcionesTiempo {
  /** Principal primero, alterno después (se usa como mucho uno alterno). */
  adaptadores: readonly AdaptadorTurno[];
}

interface Metadatos {
  tokens_entrada: number;
  tokens_salida: number;
  latencia_ms: number;
  llamadas: number;
}

export type ResultadoTurno =
  | ({ ok: true; salida: SalidaTurno; proveedor: NombreProveedor; modelo: string } & Metadatos)
  | ({
      ok: false;
      codigo: 'proveedor_fallo' | 'tiempo_agotado';
      proveedor: NombreProveedor | undefined;
      modelo: string | undefined;
      estado_proveedor: number | undefined;
    } & Metadatos);

export async function turno(solicitud: SolicitudTurno, opciones: OpcionesTurno): Promise<ResultadoTurno> {
  const inicio = opciones.ahora();
  const plazo = crearPresupuesto(opciones, inicio);
  const forzarRespuesta = contarResultados(solicitud.mensajes) >= LLAMADAS_MAXIMAS;
  let llamadas = 0;
  let ultimaFalla: FallaProveedor | undefined;
  let ultimo: AdaptadorTurno | undefined;

  for (const adaptador of opciones.adaptadores.slice(0, 2)) {
    // Sin presupuesto para el alterno se responde con la falla del principal (el manejador devuelve el cupo).
    const tiempo = plazo();
    if (tiempo === null) break;
    ultimo = adaptador;
    try {
      llamadas += 1;
      const r = await conTiempo(tiempo, (senal) =>
        adaptador.llamar({
          mensajes: solicitud.mensajes,
          herramientas: solicitud.herramientas,
          forzarRespuesta,
          senal,
        }),
      );
      return {
        ok: true,
        salida: r.salida,
        proveedor: adaptador.nombre,
        modelo: adaptador.modelo,
        tokens_entrada: r.tokens_entrada,
        tokens_salida: r.tokens_salida,
        latencia_ms: opciones.ahora() - inicio,
        llamadas,
      };
    } catch (e) {
      const falla = e instanceof FallaProveedor ? e : new FallaProveedor('servidor');
      ultimaFalla = falla;
      // Ante un 4xx (que no sea 429) el alterno no se intenta: el error es de la petición (03 §6, solo 5xx).
      if (falla.tipo === 'cliente') break;
    }
  }

  return {
    ok: false,
    codigo: ultimaFalla?.tipo === 'tiempo' ? 'tiempo_agotado' : 'proveedor_fallo',
    proveedor: ultimo?.nombre,
    modelo: ultimo?.modelo,
    estado_proveedor: ultimaFalla?.estado,
    tokens_entrada: 0,
    tokens_salida: 0,
    latencia_ms: opciones.ahora() - inicio,
    llamadas,
  };
}
