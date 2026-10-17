// Adaptadores de proveedores de LLM detrás de una sola interfaz (docs/03-ARQUITECTURA.md §6, 06 §10.1 y §11).
// Cada uno pide salida estructurada con su mecanismo nativo y la proyección del esquema que acepta. `fetch` se
// inyecta: las pruebas usan respuestas grabadas, sin llaves. Privacidad (regla 9): los errores llevan solo el
// estado HTTP, nunca el cuerpo de la petición o de la respuesta.
import esquemas from '../esquema-proveedor.json' with { type: 'json' };
import type { Prompt } from './prompt.ts';

export type NombreProveedor = 'anthropic' | 'openai' | 'google';
export const NOMBRES_PROVEEDOR: readonly NombreProveedor[] = ['anthropic', 'openai', 'google'];

/** Modelos por omisión (06 §11). Se cambian con `NLU_MODELO_<PROVEEDOR>` sin tocar la app. */
export const MODELO_POR_OMISION: Record<NombreProveedor, string> = {
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-5-mini',
  google: 'gemini-2.5-flash',
};

export const TIEMPO_MAXIMO_MS = 8000;
const TOKENS_SALIDA_MAXIMOS = 2048;

/**
 * Parámetros de generación por proveedor, fijados explícitamente para que un cambio de valores por omisión del
 * proveedor no mueva la latencia ni el costo. El intérprete es extracción a un esquema cerrado: sin razonamiento
 * extendido en ningún proveedor. Claude Haiku 5.5 no acepta `temperature` distinta de la de omisión (400), así que
 * no se manda en ningún adaptador; el formato lo garantiza la salida estructurada.
 */
export const PARAMETROS = {
  /** `medium` es el valor por omisión de Haiku 5.5; con el razonamiento apagado solo se acepta hasta `high`. */
  anthropic: { esfuerzo: 'medium' },
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
  tokens_entrada: number;
  tokens_salida: number;
}

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

export interface ConfiguracionAdaptador {
  llave: string;
  modelo?: string;
  fetch: Fetch;
  /** Solo Anthropic: `json_schema` (salida estructurada, por omisión) o `herramienta` (input_schema). */
  modoAnthropic?: 'json_schema' | 'herramienta';
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);

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
  const modo = c.modoAnthropic ?? 'json_schema';
  return {
    nombre: 'anthropic',
    modelo,
    nulable: false,
    async llamar({ prompt, reintento, senal }) {
      const mensajes: unknown[] = [{ role: 'user', content: prompt.usuario }];
      if (reintento) {
        mensajes.push({ role: 'assistant', content: reintento.salidaAnterior });
        mensajes.push({ role: 'user', content: reintento.correccion });
      }
      const cuerpo: Objeto = {
        model: modelo,
        max_tokens: TOKENS_SALIDA_MAXIMOS,
        // El sistema es fijo: se guarda en caché (06 §10).
        system: [{ type: 'text', text: prompt.sistema, cache_control: { type: 'ephemeral' } }],
        messages: mensajes,
        thinking: { type: 'disabled' },
      };
      const salidaConfig: Objeto = { effort: PARAMETROS.anthropic.esfuerzo };
      if (modo === 'herramienta') {
        cuerpo.tools = [
          {
            name: 'interpretacion',
            description: 'Devuelve la interpretación de la frase.',
            input_schema: esquemas.estandar,
          },
        ];
        cuerpo.tool_choice = { type: 'tool', name: 'interpretacion' };
      } else {
        salidaConfig.format = { type: 'json_schema', schema: esquemas.estandar };
      }
      cuerpo.output_config = salidaConfig;
      const datos = await enviar(
        c.fetch,
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': c.llave, 'anthropic-version': '2023-06-01' },
        cuerpo,
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      // Haiku 5.5 no tiene respaldo del lado de Anthropic ante un rechazo de seguridad (HTTP 200): se trata como
      // falla del servidor para que lo intente el proveedor alterno.
      if (datos.stop_reason === 'refusal') throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usage) ? datos.usage : {};
      const bloques = Array.isArray(datos.content) ? datos.content.filter(esObjeto) : [];
      const herramienta = bloques.find((b) => b.type === 'tool_use');
      const texto = herramienta
        ? JSON.stringify(herramienta.input ?? null)
        : bloques
            .filter((b) => b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text as string)
            .join('');
      return {
        texto,
        tokens_entrada:
          numero(uso.input_tokens) +
          numero(uso.cache_read_input_tokens) +
          numero(uso.cache_creation_input_tokens),
        tokens_salida: numero(uso.output_tokens),
      };
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
        mensajes.push({ role: 'assistant', content: reintento.salidaAnterior });
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
        contenidos.push({ role: 'model', parts: [{ text: reintento.salidaAnterior }] });
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
