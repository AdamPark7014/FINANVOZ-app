import type {
  ClienteTurno,
  DefinicionHerramienta,
  MensajeTurno,
  ResultadoTurno,
  SalidaTurno,
} from '@cartera/nlu';

/** Un paso del guion: la salida del modelo en esa vuelta (puede leer la conversación) o un resultado del proxy. */
export type PasoGuion =
  | SalidaTurno
  | Exclude<ResultadoTurno, { tipo: 'ok' }>
  | ((mensajes: readonly MensajeTurno[]) => SalidaTurno);

/**
 * Proveedor falso con turnos guionados para el modo explicar (CA-M10-06): cada llamada a `/llm/turno` consume el
 * siguiente paso. Guarda lo que recibió en cada vuelta (copia de la conversación y herramientas) para verificar
 * que toda cifra de la respuesta salió de un resultado de herramienta.
 */
export function turnoGuionado(guion: PasoGuion[]) {
  const vueltas: { mensajes: MensajeTurno[]; herramientas: readonly DefinicionHerramienta[] }[] = [];
  const cliente: ClienteTurno = {
    turno: async (mensajes, herramientas) => {
      vueltas.push({ mensajes: JSON.parse(JSON.stringify(mensajes)) as MensajeTurno[], herramientas });
      const paso = guion.shift();
      if (paso === undefined) throw new Error('el guion no tiene más vueltas');
      const salida = typeof paso === 'function' ? paso(mensajes) : paso;
      if (salida.tipo === 'respuesta' || salida.tipo === 'herramientas') {
        return {
          tipo: 'ok',
          salida,
          meta: { proveedor: 'falso', modelo: 'guion', tokensEntrada: 0, tokensSalida: 0, latenciaMs: 0 },
        };
      }
      return salida;
    },
  };
  /** Resultados de herramientas que el teléfono mandó, en orden. */
  const resultados = () =>
    vueltas
      .flatMap((v) => v.mensajes)
      .filter((m): m is Extract<MensajeTurno, { rol: 'herramienta' }> => m.rol === 'herramienta')
      .filter((m, i, todos) => todos.findIndex((x) => x.id === m.id) === i)
      .map((m) => m.resultado);
  return { cliente, vueltas, resultados };
}

/** Atajo: el modelo pide estas herramientas (ids `t1`, `t2`, …). */
let contador = 0;
export function pide(...llamadas: [nombre: string, argumentos?: Record<string, unknown>][]): SalidaTurno {
  return {
    tipo: 'herramientas',
    llamadas: llamadas.map(([nombre, argumentos = {}]) => ({ id: `t${++contador}`, nombre, argumentos })),
  };
}

export const responde = (texto: string): SalidaTurno => ({ tipo: 'respuesta', texto });
