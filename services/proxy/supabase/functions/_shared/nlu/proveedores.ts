// Adaptadores de proveedores de LLM detrás de una sola interfaz (docs/03-ARQUITECTURA.md §6, 06 §10.1 y §11).
// Cada uno pide salida estructurada con su mecanismo nativo y la proyección del esquema que acepta. `fetch` se
// inyecta: las pruebas usan respuestas grabadas, sin llaves. Privacidad (regla 9): los errores llevan solo el
// estado HTTP, nunca el cuerpo de la petición o de la respuesta.
import esquemas from '../esquema-proveedor.json' with { type: 'json' };
import { FORMATO_JSON, type Prompt } from './prompt.ts';

export type NombreProveedor = 'anthropic' | 'openai' | 'google';
export const NOMBRES_PROVEEDOR: readonly NombreProveedor[] = ['anthropic', 'openai', 'google'];

/** Modelos por omisión (06 §11). Se cambian con `NLU_MODELO_<PROVEEDOR>` sin tocar la app. */
export const MODELO_POR_OMISION: Record<NombreProveedor, string> = {
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-5-mini',
  google: 'gemini-2.5-flash',
};

/** Tope de cada llamada a un proveedor (03 §6: 8 s); en la práctica lo acota `PRESUPUESTO_TOTAL_MS`. */
export const TIEMPO_MAXIMO_MS = 8000;
/**
 * Presupuesto total de una petición al proxy: principal + alterno + reintento por validación descuentan de aquí.
 * Debe quedar por debajo de `TIEMPO_MAXIMO_LLM_MS` del cliente (`packages/nlu/src/cliente/cliente.ts`, 10 s) con
 * margen de red, sesión y cupo: si el teléfono se rinde antes, el resultado se pierde con el cupo ya cobrado.
 * Mantenlas coherentes (lo verifica `interpretar.test.ts`).
 */
export const PRESUPUESTO_TOTAL_MS = 7000;
/** Si lo que queda del presupuesto es menor, no se inicia otro intento. */
export const TIEMPO_MINIMO_INTENTO_MS = 1500;
/**
 * Tope de cada intento del intérprete (`interpretar`): con el presupuesto de 7 s caben un intento de 4 s y un segundo
 * de hasta 3 s (con el alterno o, sin alterno, con el mismo proveedor). Con el tope de 8 s el primer intento se
 * llevaba todo el presupuesto: en la medición del 22-10, 3 de ~190 llamadas pasaron de 7 s y terminaron en tiempo
 * agotado sin reintento. El modo explicar (`llm/turno.ts`) conserva `TIEMPO_MAXIMO_MS`.
 */
export const TIEMPO_INTENTO_INTERPRETAR_MS = 4000;
const TOKENS_SALIDA_MAXIMOS = 2048;

/**
 * Raíz de la API de Anthropic. `ANTHROPIC_BASE_URL` la cambia sin tocar nada más del contrato (p. ej. la puerta
 * única https://ia.zynoratek.com, compatible con la API de Anthropic y autenticada con `x-api-key`).
 */
export const URL_BASE_ANTHROPIC = 'https://api.anthropic.com';
/** Versión de la API de Anthropic. Con 2026-10-21, `temperature`/`top_p`/`top_k` dan 400: no se mandan. */
export const VERSION_API_ANTHROPIC = '2026-10-21';
/**
 * Tope de salida en Anthropic. Es un respaldo, no un ajuste de costo (solo se cobra lo generado): la respuesta más
 * larga del golden set mide ~230 tokens y 10 movimientos (el máximo del esquema) caben de sobra.
 */
export const TOKENS_SALIDA_ANTHROPIC = 1024;

/** URL de Messages a partir de la raíz configurada (sin barra final). */
export const urlMensajesAnthropic = (base?: string) =>
  `${(base?.trim() || URL_BASE_ANTHROPIC).replace(/\/+$/, '')}/v1/messages`;

/**
 * Parámetros de generación por proveedor, fijados explícitamente para que un cambio de valores por omisión del
 * proveedor no mueva la latencia ni el costo. El intérprete es extracción a un esquema cerrado: sin razonamiento
 * extendido en ningún proveedor. Claude Haiku 5.5 no acepta `temperature` distinta de la de omisión (400), así que
 * no se manda en ningún adaptador; el formato lo garantiza la salida estructurada.
 */
export const PARAMETROS = {
  /**
   * `low`: con `thinking` apagado (aceptado en low/medium/high) y la herramienta forzada, el esfuerzo bajo no perdió
   * precisión en el golden set (services/proxy/README.md, costos).
   */
  anthropic: { esfuerzo: 'low' },
  /** `low` lo aceptan todos los modelos de razonamiento de OpenAI (el valor por omisión es `medium`). */
  openai: { esfuerzoRazonamiento: 'low' },
  /** Gemini Flash razona por omisión: presupuesto 0 lo apaga, igual que en el modo explicar. */
  google: { presupuestoRazonamiento: 0 },
} as const;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Turno del reintento por validación: la salida anterior y la corrección pedida. */
export interface Reintento {
  salidaAnterior: string;
  correccion: string;
}

export interface Llamada {
  prompt: Prompt;
  reintento?: Reintento;
  senal: AbortSignal;
}

export interface RespuestaProveedor {
  /** Texto JSON tal como lo devolvió el modelo (se interpreta y valida afuera). */
  texto: string;
  /** Entrada total (incluye la leída y la escrita en caché). */
  tokens_entrada: number;
  tokens_salida: number;
  /** De la entrada, cuántos se leyeron de caché (0.1×) y cuántos se escribieron (1.25×), si el proveedor lo dice. */
  tokens_cache_leidos?: number;
  tokens_cache_escritos?: number;
  /** La salida llegó al tope de tokens (`stop_reason: max_tokens`): el JSON viene incompleto. */
  cortada?: boolean;
}

/**
 * Turno del asistente para el reintento: la API rechaza un contenido vacío (400), así que una salida vacía (sin
 * herramienta ni texto) se manda con un marcador.
 */
export const salidaParaReintento = (salida: string) => salida.trim() || '(sin respuesta)';

export type TipoFalla = 'servidor' | 'tiempo' | 'cliente';

/** Falla de un proveedor. `servidor` (5xx, 429 o red) y `tiempo` permiten intentar con el alterno. */
export class FallaProveedor extends Error {
  readonly tipo: TipoFalla;
  readonly estado: number | undefined;
  constructor(tipo: TipoFalla, estado?: number) {
    super(`falla del proveedor: ${tipo}${estado === undefined ? '' : ` ${estado}`}`);
    this.name = 'FallaProveedor';
    this.tipo = tipo;
    this.estado = estado;
  }
}

export interface Adaptador {
  nombre: NombreProveedor;
  modelo: string;
  /** `true` si el proveedor recibe la variante nulable y hay que quitar los `null` antes de validar. */
  nulable: boolean;
  llamar(llamada: Llamada): Promise<RespuestaProveedor>;
}

/**
 * Cómo se pide la salida a Anthropic:
 * - `herramienta`: `tools[].input_schema` con la proyección y la herramienta forzada (~9,700 tokens de esquema).
 * - `herramienta_minima`: la herramienta forzada con un esquema de una sola propiedad (`interpretacion`, objeto) y la
 *   forma completa en el sistema (`FORMATO_JSON`, ~1,000 tokens). Conserva la salida por herramienta (siempre JSON,
 *   sin texto alrededor) con un prefijo fijo de ~6,700 tokens en vez de ~15,400; Zod valida igual después.
 * - `texto`: sin esquema nativo; la forma va en el sistema (`FORMATO_JSON`) y Zod valida después.
 * - `json_schema`: `output_config.format`. La salida estricta rechaza la proyección actual con 400 (78 parámetros
 *   opcionales; el límite es 24), así que solo sirve si el esquema se reduce.
 */
export type ModoAnthropic = 'herramienta' | 'herramienta_minima' | 'texto' | 'json_schema';
export const MODOS_ANTHROPIC: readonly ModoAnthropic[] = [
  'herramienta',
  'herramienta_minima',
  'texto',
  'json_schema',
];
export const MODO_ANTHROPIC_POR_OMISION: ModoAnthropic = 'herramienta';
/** Lee `NLU_ANTHROPIC_MODO`; un valor desconocido o vacío da el modo por omisión. */
export const leerModoAnthropic = (valor: string | undefined): ModoAnthropic =>
  (MODOS_ANTHROPIC as readonly string[]).includes(valor ?? '')
    ? (valor as ModoAnthropic)
    : MODO_ANTHROPIC_POR_OMISION;

/** Modelos que rechazan la herramienta forzada (`tool_choice` tool/any → 400): con ellos `herramienta` pasa a `texto`. */
const SIN_HERRAMIENTA_FORZADA = /^claude-(sonnet-5-5|opus-5-5|fable-5-1|mythos-5-1)/;
/**
 * `thinking` más bajo que acepta cada modelo: Sonnet 5.5 rechaza `disabled` (400) y pide `between_tools`; los demás
 * (Haiku 5.5 incluido, con esfuerzo hasta `high`) aceptan `disabled`. Así `NLU_MODELO_ANTHROPIC` no rompe la llamada.
 */
export const pensamientoMinimo = (modelo: string) =>
  ({ type: /^claude-sonnet-5-5/.test(modelo) ? 'between_tools' : 'disabled' }) as const;
/** Modo efectivo para un modelo: la herramienta forzada solo donde el modelo la acepta. */
export const modoParaModelo = (modo: ModoAnthropic, modelo: string): ModoAnthropic =>
  (modo === 'herramienta' || modo === 'herramienta_minima') && SIN_HERRAMIENTA_FORZADA.test(modelo)
    ? 'texto'
    : modo;

/**
 * Corte de caché del prefijo fijo (herramienta + sistema) con vida de 1 h. La escritura cuesta 2× la entrada (contra
 * 1.25× la de 5 min) pero se paga una vez por hora: con tráfico espaciado (una frase cada 5 min a 1 h, como en las
 * pruebas y con pocos usuarios) cada frase ya no reescribe el prefijo; con tráfico alto la caché se lee en cada frase
 * y da igual. Lo usan el intérprete y el modo explicar (`llm/proveedores.ts`).
 */
export const CACHE_PREFIJO = { type: 'ephemeral', ttl: '1h' } as const;

/**
 * Encabezado que la puerta única (`ia.zynoratek.com`) registra por función para separar el gasto; la puerta no lo
 * reenvía a Anthropic y, si no lo conoce, lo ignora.
 */
export const ENCABEZADO_PROCESO = 'x-proceso';
export const PROCESO_INTERPRETAR = 'finanvoz-interpretar';
export const PROCESO_EXPLICAR = 'finanvoz-explicar';

/** Esquema de la herramienta en `herramienta_minima`: la forma detallada va en el sistema (`FORMATO_JSON`). */
export const ESQUEMA_HERRAMIENTA_MINIMA = {
  type: 'object',
  properties: {
    interpretacion: {
      type: 'object',
      description: 'La interpretación I, con la forma de «Formato de salida» del sistema.',
    },
  },
  required: ['interpretacion'],
} as const;

export interface ConfiguracionAdaptador {
  llave: string;
  modelo?: string;
  fetch: Fetch;
  /** Solo Anthropic (`NLU_ANTHROPIC_MODO`); ver `ModoAnthropic` y `MODO_ANTHROPIC_POR_OMISION`. */
  modoAnthropic?: ModoAnthropic;
  /** Solo Anthropic: raíz de la API (`ANTHROPIC_BASE_URL`); por omisión `URL_BASE_ANTHROPIC`. */
  urlBase?: string;
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Sin modo estricto, el modelo a veces manda un objeto anidado (casi siempre `interpretacion`) como texto JSON. Se
 * abre aquí en vez de gastar el reintento por validación; Zod valida igual después.
 */
export function abrirTextoJson(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 8) return valor;
  if (typeof valor === 'string') {
    const t = valor.trim();
    if (!((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')))) return valor;
    // A veces cierra el texto con una llave de más (la del objeto que lo envolvía): se prueba quitándola.
    for (let quitar = 0; quitar <= 2; quitar += 1) {
      const candidato = t.slice(0, t.length - quitar);
      if (quitar > 0 && !/^[}\]]+$/.test(t.slice(t.length - quitar))) break;
      try {
        return abrirTextoJson(JSON.parse(candidato) as unknown, profundidad + 1);
      } catch {
        // Siguiente candidato.
      }
    }
    return valor;
  }
  if (Array.isArray(valor)) return valor.map((v) => abrirTextoJson(v, profundidad + 1));
  if (esObjeto(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, abrirTextoJson(v, profundidad + 1)]));
  }
  return valor;
}

/** Saca el objeto JSON de una respuesta en texto: quita un bloque de código o texto alrededor si el modelo lo puso. */
export function extraerJson(texto: string): string {
  const t = texto.trim();
  const inicio = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  return inicio >= 0 && fin > inicio ? t.slice(inicio, fin + 1) : t;
}

/** Medidores de uso de Anthropic: entrada total (sin caché + leída + escrita), salida y caché por separado. */
export function usoAnthropic(uso: unknown) {
  const u = esObjeto(uso) ? uso : {};
  const leidos = numero(u.cache_read_input_tokens);
  const escritos = numero(u.cache_creation_input_tokens);
  return {
    tokens_entrada: numero(u.input_tokens) + leidos + escritos,
    tokens_salida: numero(u.output_tokens),
    tokens_cache_leidos: leidos,
    tokens_cache_escritos: escritos,
  };
}

/** POST JSON al proveedor con la señal de tiempo; ante error lanza `FallaProveedor` sin leer el cuerpo. */
export async function enviar(
  fetchFn: Fetch,
  url: string,
  encabezados: Record<string, string>,
  cuerpo: unknown,
  senal: AbortSignal,
) {
  let respuesta: Response;
  try {
    respuesta = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...encabezados },
      body: JSON.stringify(cuerpo),
      signal: senal,
    });
  } catch {
    throw new FallaProveedor(senal.aborted ? 'tiempo' : 'servidor');
  }
  if (!respuesta.ok) {
    // El cuerpo del error se descarta sin leerlo en logs.
    await respuesta.body?.cancel().catch(() => undefined);
    const tipo: TipoFalla = respuesta.status >= 500 || respuesta.status === 429 ? 'servidor' : 'cliente';
    throw new FallaProveedor(tipo, respuesta.status);
  }
  try {
    return (await respuesta.json()) as unknown;
  } catch {
    throw new FallaProveedor(senal.aborted ? 'tiempo' : 'servidor', respuesta.status);
  }
}

export function crearAnthropic(c: ConfiguracionAdaptador): Adaptador {
  const modelo = c.modelo ?? MODELO_POR_OMISION.anthropic;
  const modo = modoParaModelo(c.modoAnthropic ?? MODO_ANTHROPIC_POR_OMISION, modelo);
  const url = urlMensajesAnthropic(c.urlBase);
  return {
    nombre: 'anthropic',
    modelo,
    nulable: false,
    async llamar({ prompt, reintento, senal }) {
      const mensajes: unknown[] = [{ role: 'user', content: prompt.usuario }];
      if (reintento) {
        mensajes.push({ role: 'assistant', content: salidaParaReintento(reintento.salidaAnterior) });
        mensajes.push({ role: 'user', content: reintento.correccion });
      }
      const cuerpo: Objeto = {
        model: modelo,
        max_tokens: TOKENS_SALIDA_ANTHROPIC,
        // Herramienta y sistema son fijos y van antes que el turno del usuario: el corte de caché al final del
        // sistema cubre a los dos (06 §10). Nada variable va antes del corte.
        system: [
          {
            type: 'text',
            text:
              modo === 'texto' || modo === 'herramienta_minima'
                ? `${prompt.sistema}\n\n${FORMATO_JSON}`
                : prompt.sistema,
            cache_control: CACHE_PREFIJO,
          },
        ],
        messages: mensajes,
        // Extracción a un esquema cerrado: sin razonamiento extendido (con la herramienta forzada no se usaría).
        thinking: pensamientoMinimo(modelo),
      };
      const salidaConfig: Objeto = { effort: PARAMETROS.anthropic.esfuerzo };
      if (modo === 'herramienta' || modo === 'herramienta_minima') {
        cuerpo.tools = [
          {
            name: 'interpretacion',
            description: 'Devuelve la interpretación de la frase.',
            input_schema: modo === 'herramienta' ? esquemas.estandar : ESQUEMA_HERRAMIENTA_MINIMA,
          },
        ];
        cuerpo.tool_choice = { type: 'tool', name: 'interpretacion' };
      } else if (modo === 'json_schema') {
        salidaConfig.format = { type: 'json_schema', schema: esquemas.estandar };
      }
      cuerpo.output_config = salidaConfig;
      const datos = await enviar(
        c.fetch,
        url,
        {
          'x-api-key': c.llave,
          'anthropic-version': VERSION_API_ANTHROPIC,
          [ENCABEZADO_PROCESO]: PROCESO_INTERPRETAR,
        },
        cuerpo,
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      // Haiku 5.5 no tiene respaldo del lado de Anthropic ante un rechazo de seguridad (HTTP 200): se trata como
      // falla del servidor para que lo intente el proveedor alterno.
      if (datos.stop_reason === 'refusal') throw new FallaProveedor('servidor');
      const bloques = Array.isArray(datos.content) ? datos.content.filter(esObjeto) : [];
      const herramienta = bloques.find((b) => b.type === 'tool_use');
      const texto = herramienta
        ? JSON.stringify(abrirTextoJson(herramienta.input ?? null))
        : extraerJson(
            bloques
              .filter((b) => b.type === 'text' && typeof b.text === 'string')
              .map((b) => b.text as string)
              .join(''),
          );
      // Con `max_tokens` el JSON llega incompleto: lo dice para que el reintento pida una respuesta más corta.
      const cortada = datos.stop_reason === 'max_tokens';
      return { texto, ...usoAnthropic(datos.usage), ...(cortada ? { cortada } : {}) };
    },
  };
}

export function crearOpenAI(c: ConfiguracionAdaptador): Adaptador {
  const modelo = c.modelo ?? MODELO_POR_OMISION.openai;
  return {
    nombre: 'openai',
    modelo,
    nulable: true,
    async llamar({ prompt, reintento, senal }) {
      const mensajes: unknown[] = [
        { role: 'system', content: prompt.sistema },
        { role: 'user', content: prompt.usuario },
      ];
      if (reintento) {
        mensajes.push({ role: 'assistant', content: salidaParaReintento(reintento.salidaAnterior) });
        mensajes.push({ role: 'user', content: reintento.correccion });
      }
      const datos = await enviar(
        c.fetch,
        'https://api.openai.com/v1/chat/completions',
        { authorization: `Bearer ${c.llave}` },
        {
          model: modelo,
          messages: mensajes,
          max_completion_tokens: TOKENS_SALIDA_MAXIMOS,
          reasoning_effort: PARAMETROS.openai.esfuerzoRazonamiento,
          store: false,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'interpretacion', strict: true, schema: esquemas.nulable },
          },
        },
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usage) ? datos.usage : {};
      const opcion = Array.isArray(datos.choices) && esObjeto(datos.choices[0]) ? datos.choices[0] : {};
      const mensaje = esObjeto(opcion.message) ? opcion.message : {};
      return {
        texto: typeof mensaje.content === 'string' ? mensaje.content : '',
        tokens_entrada: numero(uso.prompt_tokens),
        tokens_salida: numero(uso.completion_tokens),
      };
    },
  };
}

export function crearGoogle(c: ConfiguracionAdaptador): Adaptador {
  const modelo = c.modelo ?? MODELO_POR_OMISION.google;
  return {
    nombre: 'google',
    modelo,
    nulable: false,
    async llamar({ prompt, reintento, senal }) {
      const contenidos: unknown[] = [{ role: 'user', parts: [{ text: prompt.usuario }] }];
      if (reintento) {
        contenidos.push({ role: 'model', parts: [{ text: salidaParaReintento(reintento.salidaAnterior) }] });
        contenidos.push({ role: 'user', parts: [{ text: reintento.correccion }] });
      }
      const datos = await enviar(
        c.fetch,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
        { 'x-goog-api-key': c.llave },
        {
          systemInstruction: { parts: [{ text: prompt.sistema }] },
          contents: contenidos,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: esquemas.estandar,
            maxOutputTokens: TOKENS_SALIDA_MAXIMOS,
            thinkingConfig: { thinkingBudget: PARAMETROS.google.presupuestoRazonamiento },
          },
        },
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usageMetadata) ? datos.usageMetadata : {};
      const candidato =
        Array.isArray(datos.candidates) && esObjeto(datos.candidates[0]) ? datos.candidates[0] : {};
      const contenido = esObjeto(candidato.content) ? candidato.content : {};
      const partes = Array.isArray(contenido.parts) ? contenido.parts.filter(esObjeto) : [];
      return {
        texto: partes
          .filter((p) => typeof p.text === 'string' && p.thought !== true)
          .map((p) => p.text as string)
          .join(''),
        tokens_entrada: numero(uso.promptTokenCount),
        // Los tokens de razonamiento se cobran como salida.
        tokens_salida: numero(uso.candidatesTokenCount) + numero(uso.thoughtsTokenCount),
      };
    },
  };
}

export const CREADORES: Record<NombreProveedor, (c: ConfiguracionAdaptador) => Adaptador> = {
  anthropic: crearAnthropic,
  openai: crearOpenAI,
  google: crearGoogle,
};
