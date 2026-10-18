import {
  consultaDeHerramienta,
  HERRAMIENTAS_EXPLICAR,
  validarCifras,
  type CodigoLimite,
  type ConsultaHerramienta,
  type LlamadaHerramienta,
  type MensajeTurno,
} from '@cartera/nlu';
import { responderConsulta, type LineaConsulta, type RespuestaConsulta } from './consultas';
import type { EventoAnalitica } from '../analitica/eventos';
import type { Contexto } from './contexto';
import type { FiltroMovimientos } from './movimientos';
import type { NivelNube } from './nube';
import { funcionesPlan } from './plan';

/**
 * Modo explicar (`06 §6`, `02 §22`, RF-CON-02, Plus): preguntas abiertas ("¿por qué no me alcanzó la quincena
 * pasada?") resueltas con un bucle de herramientas. El modelo (vía `POST /llm/turno`) pide consultas de solo
 * lectura; el teléfono las ejecuta contra su libro con las mismas plantillas de `consultas` y le devuelve solo el
 * resultado agregado. La respuesta del modelo se muestra solo si cada cifra que escribe aparece en algún resultado
 * (regla 4); si no, se muestra la respuesta en plantilla con "No pude explicarlo mejor". Solo sale el evento
 * `modo_explicar` de la lista blanca (resultado y vueltas); nada más se registra (regla 9) y nada escribe en el
 * libro.
 */

/** Llamadas a herramientas por pregunta (`06 §6`). */
export const LLAMADAS_MAXIMAS_EXPLICAR = 3;
/** Pie fijo de la respuesta (`02 §22`). */
export const PIE_EXPLICAR = 'Responde con tus datos; no es asesoría financiera.';
/** Aviso cuando la respuesta del modelo no pasó la validación de cifras (`02 §22`). */
export const AVISO_SIN_EXPLICACION = 'No pude explicarlo mejor';

const PREGUNTA_MAXIMA = 500;
const NOMBRES: ReadonlySet<string> = new Set(HERRAMIENTAS_EXPLICAR.map((h) => h.nombre));
const RESULTADO_MAXIMO = 4000;

/** Respuesta de plantilla cuando el modelo no consultó nada: el gasto contra el mes pasado y lo que más pesa. */
const PLANTILLA_POR_OMISION: readonly ConsultaHerramienta[] = [
  { tipo: 'comparar_periodos' },
  { tipo: 'mayores_gastos' },
];

export type RespuestaExplicar =
  /** La explicación del modelo, con todas sus cifras verificadas. */
  | {
      readonly tipo: 'explicacion';
      readonly texto: string;
      readonly filtro: FiltroMovimientos;
      readonly vueltas: number;
    }
  /** La validación falló (o el modelo no terminó): respuestas en plantilla de lo que se consultó. */
  | {
      readonly tipo: 'plantilla';
      readonly aviso: typeof AVISO_SIN_EXPLICACION;
      readonly respuestas: readonly RespuestaConsulta[];
      readonly filtro: FiltroMovimientos;
      readonly vueltas: number;
    }
  /** En Gratis (o el servidor dice que Plus ya no está vigente): no se pregunta nada. */
  | { readonly tipo: 'solo_plus' }
  | { readonly tipo: 'sin_red' }
  | { readonly tipo: 'limite'; readonly codigo: CodigoLimite }
  | { readonly tipo: 'error' };

export interface OpcionesExplicar {
  readonly nube?: NivelNube | null;
  readonly registrarEvento?: (evento: EventoAnalitica) => void;
}

/** Resultado que viaja al modelo: la frase y las filas de la plantilla, sin ids ni filtros. */
function serializar(r: RespuestaConsulta): string {
  const lineas: LineaConsulta[] = [...r.lineas];
  let texto = JSON.stringify({ texto: r.texto, lineas });
  while (texto.length > RESULTADO_MAXIMO && lineas.length > 0) {
    lineas.pop();
    texto = JSON.stringify({ texto: r.texto, lineas, recortado: true });
  }
  return texto.slice(0, RESULTADO_MAXIMO);
}

const filtroDe = (respuestas: readonly RespuestaConsulta[]): FiltroMovimientos =>
  respuestas.find((r) => Object.keys(r.filtro).length > 0)?.filtro ?? {};

function emitirModoExplicar(opciones: OpcionesExplicar, resultado: 'explicacion' | 'plantilla', vueltas: number) {
  opciones.registrarEvento?.({
    nombre: 'modo_explicar',
    propiedades: { resultado, vueltas },
  });
}

function plantilla(
  ctx: Contexto,
  respuestas: readonly RespuestaConsulta[],
  vueltas: number,
  opciones: OpcionesExplicar,
): RespuestaExplicar {
  const lista =
    respuestas.length > 0 ? respuestas : PLANTILLA_POR_OMISION.map((c) => responderConsulta(ctx, c));
  emitirModoExplicar(opciones, 'plantilla', vueltas);
  return {
    tipo: 'plantilla',
    aviso: AVISO_SIN_EXPLICACION,
    respuestas: lista,
    filtro: filtroDe(lista),
    vueltas,
  };
}

/** Ejecuta una llamada del modelo. Argumentos inválidos o una herramienta desconocida no ejecutan nada. */
function ejecutar(
  ctx: Contexto,
  l: LlamadaHerramienta,
): { resultado: string; respuesta: RespuestaConsulta | null } {
  const consulta = consultaDeHerramienta(l.nombre, l.argumentos);
  if (!consulta) return { resultado: '{"error":"argumentos_invalidos"}', respuesta: null };
  try {
    const respuesta = responderConsulta(ctx, consulta);
    return { resultado: serializar(respuesta), respuesta };
  } catch {
    return { resultado: '{"error":"no_disponible"}', respuesta: null };
  }
}

/**
 * Responde una pregunta abierta. Máximo 3 llamadas a herramientas: si el modelo pide más en una vuelta, se
 * ejecutan las que caben; con 3 resultados el proxy ya no le ofrece herramientas y debe responder.
 */
export async function explicar(
  ctx: Contexto,
  pregunta: string,
  opciones: OpcionesExplicar = {},
): Promise<RespuestaExplicar> {
  if (!funcionesPlan(ctx).explicar) return { tipo: 'solo_plus' };
  const cliente = opciones.nube?.turno;
  if (!opciones.nube || !cliente) return { tipo: 'sin_red' };
  try {
    if (!(await opciones.nube.conectividad.enLinea())) return { tipo: 'sin_red' };
  } catch {
    return { tipo: 'sin_red' };
  }

  const mensajes: MensajeTurno[] = [{ rol: 'usuario', texto: pregunta.trim().slice(0, PREGUNTA_MAXIMA) }];
  const resultados: string[] = [];
  const respuestas: RespuestaConsulta[] = [];
  let vueltas = 0;

  // Una vuelta por llamada como máximo, más la respuesta final.
  for (let vuelta = 0; vuelta <= LLAMADAS_MAXIMAS_EXPLICAR; vuelta++) {
    vueltas += 1;
    const r = await cliente.turno(mensajes, HERRAMIENTAS_EXPLICAR);
    if (r.tipo === 'solo_plus') return { tipo: 'solo_plus' };
    if (r.tipo === 'limite') return { tipo: 'limite', codigo: r.codigo };
    if (r.tipo !== 'ok') {
      // A media pregunta, lo ya consultado se muestra en plantilla.
      if (respuestas.length > 0) return plantilla(ctx, respuestas, vueltas, opciones);
      return r.tipo === 'sin_red' ? { tipo: 'sin_red' } : { tipo: 'error' };
    }

    if (r.salida.tipo === 'respuesta') {
      const v = validarCifras(r.salida.texto, resultados);
      if (v.ok) {
        emitirModoExplicar(opciones, 'explicacion', vueltas);
        return {
          tipo: 'explicacion',
          texto: r.salida.texto,
          filtro: filtroDe(respuestas),
          vueltas,
        };
      }
      return plantilla(ctx, respuestas, vueltas, opciones);
    }

    // Solo herramientas que existen (el proxy rechaza una conversación con otras) y las que caben.
    const llamadas = r.salida.llamadas
      .filter((l) => NOMBRES.has(l.nombre))
      .slice(0, LLAMADAS_MAXIMAS_EXPLICAR - resultados.length);
    if (llamadas.length === 0) break;
    mensajes.push({ rol: 'asistente', llamadas });
    for (const l of llamadas) {
      const e = ejecutar(ctx, l);
      resultados.push(e.resultado);
      if (e.respuesta) respuestas.push(e.respuesta);
      mensajes.push({ rol: 'herramienta', id: l.id, nombre: l.nombre, resultado: e.resultado });
    }
  }
  return plantilla(ctx, respuestas, vueltas, opciones);
}
