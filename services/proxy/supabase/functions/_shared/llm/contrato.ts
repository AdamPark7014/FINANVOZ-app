// Contrato de `POST /llm/turno` (docs/03-ARQUITECTURA.md §6, docs/06-NLU.md §6): un turno del modo explicar, sin
// estado. El teléfono manda la conversación completa (pregunta, llamadas a herramientas y sus resultados
// agregados) y las definiciones de sus herramientas de solo lectura; el proxy responde con el mensaje del
// asistente o con las llamadas que pide el modelo. Puro: lo usan la Edge Function (Deno) y las pruebas (Vitest).

/** Una llamada a herramienta pedida por el modelo. `argumentos` es el objeto JSON que propuso. */
export interface LlamadaHerramienta {
  id: string;
  nombre: string;
  argumentos: Record<string, unknown>;
}

export type MensajeTurno =
  | { rol: 'usuario'; texto: string }
  | { rol: 'asistente'; texto?: string; llamadas?: LlamadaHerramienta[] }
  | { rol: 'herramienta'; id: string; nombre: string; resultado: string };

/** Definición de una herramienta del teléfono (JSON Schema de sus parámetros). */
export interface DefinicionHerramienta {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
}

export interface SolicitudTurno {
  mensajes: MensajeTurno[];
  herramientas: DefinicionHerramienta[];
}

export type SalidaTurno =
  { tipo: 'respuesta'; texto: string } | { tipo: 'herramientas'; llamadas: LlamadaHerramienta[] };

export interface RespuestaTurno {
  salida: SalidaTurno;
  proveedor: string;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  latencia_ms: number;
}

/** Códigos de error del cuerpo `{ error }` y su estado HTTP. */
export const ESTADO_POR_ERROR = {
  solicitud_invalida: 400,
  no_autorizado: 401,
  solo_plus: 403,
  metodo: 405,
  limite_diario: 429,
  limite_mensual: 429,
  tope_global: 429,
  proveedor_fallo: 502,
  sin_configurar: 503,
  tiempo_agotado: 504,
  error_interno: 500,
} as const;
export type CodigoError = keyof typeof ESTADO_POR_ERROR;

/** Llamadas a herramientas por pregunta (`06 §6`). Con 3 resultados el proxy ya no ofrece herramientas. */
export const LLAMADAS_MAXIMAS = 3;
export const CUERPO_MAXIMO_BYTES = 32 * 1024;
export const PREGUNTA_MAXIMA = 500;
export const RESULTADO_MAXIMO = 4000;
export const TEXTO_ASISTENTE_MAXIMO = 2000;
export const HERRAMIENTAS_MAXIMAS = 12;
const MENSAJES_MAXIMOS = 1 + 2 * LLAMADAS_MAXIMAS;
const DESCRIPCION_MAXIMA = 400;
const PARAMETROS_MAXIMOS_BYTES = 2048;
const NOMBRE = /^[a-z][a-z0-9_]{0,39}$/;
const ID = /^[\w-]{1,64}$/;

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);
const soloClaves = (o: Objeto, permitidas: readonly string[]) =>
  Object.keys(o).every((c) => permitidas.includes(c));
const textoHasta = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.length <= max;

function herramientaValida(v: unknown): v is DefinicionHerramienta {
  if (!esObjeto(v) || !soloClaves(v, ['nombre', 'descripcion', 'parametros'])) return false;
  if (typeof v.nombre !== 'string' || !NOMBRE.test(v.nombre)) return false;
  if (!textoHasta(v.descripcion, DESCRIPCION_MAXIMA)) return false;
  if (!esObjeto(v.parametros) || v.parametros.type !== 'object') return false;
  return JSON.stringify(v.parametros).length <= PARAMETROS_MAXIMOS_BYTES;
}

function llamadaValida(v: unknown, nombres: ReadonlySet<string>): v is LlamadaHerramienta {
  if (!esObjeto(v) || !soloClaves(v, ['id', 'nombre', 'argumentos'])) return false;
  if (typeof v.id !== 'string' || !ID.test(v.id)) return false;
  if (typeof v.nombre !== 'string' || !nombres.has(v.nombre)) return false;
  return esObjeto(v.argumentos);
}

/**
 * Valida la conversación. Las reglas hacen que el proxy no sirva como chat de uso general: empieza con una sola
 * pregunta del usuario (≤ 500 caracteres) y después solo alterna llamadas del asistente con sus resultados; cada
 * resultado responde a una llamada pendiente; a lo más 3 resultados por pregunta; el último mensaje es del
 * usuario o un resultado (le toca al modelo). Claves desconocidas se rechazan.
 */
export function validarSolicitud(cuerpo: unknown): SolicitudTurno | null {
  if (!esObjeto(cuerpo) || !soloClaves(cuerpo, ['mensajes', 'herramientas'])) return null;
  const { mensajes, herramientas } = cuerpo;
  if (!Array.isArray(herramientas) || herramientas.length < 1 || herramientas.length > HERRAMIENTAS_MAXIMAS)
    return null;
  if (!herramientas.every(herramientaValida)) return null;
  const nombres = new Set(herramientas.map((h) => h.nombre));
  if (nombres.size !== herramientas.length) return null;

  if (!Array.isArray(mensajes) || mensajes.length < 1 || mensajes.length > MENSAJES_MAXIMOS) return null;
  const [primero, ...resto] = mensajes as unknown[];
  if (!esObjeto(primero) || !soloClaves(primero, ['rol', 'texto']) || primero.rol !== 'usuario') return null;
  if (!textoHasta(primero.texto, PREGUNTA_MAXIMA)) return null;

  const pendientes = new Map<string, string>();
  let resultados = 0;
  let anterior: 'usuario' | 'asistente' | 'herramienta' = 'usuario';
  for (const m of resto) {
    if (!esObjeto(m)) return null;
    if (m.rol === 'asistente') {
      // Solo llamadas: el texto final del asistente nunca vuelve al proxy (la pregunta termina con él).
      if (anterior === 'asistente' || pendientes.size > 0) return null;
      if (!soloClaves(m, ['rol', 'texto', 'llamadas'])) return null;
      if (m.texto !== undefined && !textoHasta(m.texto, TEXTO_ASISTENTE_MAXIMO)) return null;
      if (!Array.isArray(m.llamadas) || m.llamadas.length < 1) return null;
      for (const l of m.llamadas) {
        if (!llamadaValida(l, nombres) || pendientes.has(l.id)) return null;
        pendientes.set(l.id, l.nombre);
      }
      anterior = 'asistente';
    } else if (m.rol === 'herramienta') {
      if (!soloClaves(m, ['rol', 'id', 'nombre', 'resultado'])) return null;
      if (typeof m.id !== 'string' || pendientes.get(m.id) !== m.nombre) return null;
      if (!textoHasta(m.resultado, RESULTADO_MAXIMO)) return null;
      pendientes.delete(m.id);
      resultados += 1;
      anterior = 'herramienta';
    } else {
      return null;
    }
  }
  if (anterior === 'asistente' || pendientes.size > 0 || resultados > LLAMADAS_MAXIMAS) return null;
  return { mensajes: mensajes as MensajeTurno[], herramientas: herramientas as DefinicionHerramienta[] };
}

/** Resultados de herramientas que ya trae la conversación. */
export const contarResultados = (mensajes: readonly MensajeTurno[]) =>
  mensajes.filter((m) => m.rol === 'herramienta').length;

/** La primera vuelta de una pregunta: todavía no hay resultados de herramientas. */
export const esPreguntaNueva = (mensajes: readonly MensajeTurno[]) => contarResultados(mensajes) === 0;
