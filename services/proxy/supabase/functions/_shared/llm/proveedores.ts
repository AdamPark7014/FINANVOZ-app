// Adaptadores del modo explicar (`POST /llm/turno`): la conversación neutral del contrato se traduce al uso de
// herramientas nativo de cada proveedor (Anthropic `tool_use`, OpenAI `tool_calls`, Google `functionCall`) y la
// respuesta vuelve a la forma neutral. `fetch` se inyecta (las pruebas usan respuestas con la forma pública de
// cada API). Privacidad (regla 9): las fallas llevan solo el estado HTTP (`FallaProveedor`).
import {
  enviar,
  FallaProveedor,
  type Fetch,
  MODELO_POR_OMISION,
  type NombreProveedor,
} from '../nlu/proveedores.ts';
import {
  contarResultados,
  type DefinicionHerramienta,
  type LlamadaHerramienta,
  type MensajeTurno,
  type SalidaTurno,
} from './contrato.ts';
import { SISTEMA_EXPLICAR } from './prompt.ts';

const TOKENS_SALIDA_MAXIMOS = 1024;

export interface LlamadaTurno {
  mensajes: readonly MensajeTurno[];
  herramientas: readonly DefinicionHerramienta[];
  /** `true` cuando ya se usaron las 3 llamadas: el modelo debe responder sin pedir más herramientas. */
  forzarRespuesta: boolean;
  senal: AbortSignal;
}

export interface RespuestaProveedorTurno {
  salida: SalidaTurno;
  tokens_entrada: number;
  tokens_salida: number;
}

export interface AdaptadorTurno {
  nombre: NombreProveedor;
  modelo: string;
  llamar(llamada: LlamadaTurno): Promise<RespuestaProveedorTurno>;
}

export interface ConfiguracionTurno {
  llave: string;
  modelo?: string;
  fetch: Fetch;
}

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function salida(texto: string, llamadas: LlamadaHerramienta[], forzar: boolean): SalidaTurno {
  if (llamadas.length > 0 && !forzar) return { tipo: 'herramientas', llamadas };
  return { tipo: 'respuesta', texto: texto.trim() };
}

/** Agrupa los resultados consecutivos: Anthropic y Google los esperan juntos en un solo turno del usuario. */
function enBloques(mensajes: readonly MensajeTurno[]) {
  const bloques: (MensajeTurno | Extract<MensajeTurno, { rol: 'herramienta' }>[])[] = [];
  for (const m of mensajes) {
    const ultimo = bloques[bloques.length - 1];
    if (m.rol === 'herramienta') {
      if (Array.isArray(ultimo)) ultimo.push(m);
      else bloques.push([m]);
    } else {
      bloques.push(m);
    }
  }
  return bloques;
}

export function crearAnthropicTurno(c: ConfiguracionTurno): AdaptadorTurno {
  const modelo = c.modelo ?? MODELO_POR_OMISION.anthropic;
  return {
    nombre: 'anthropic',
    modelo,
    async llamar({ mensajes, herramientas, forzarRespuesta, senal }) {
      const messages = enBloques(mensajes).map((b) => {
        if (Array.isArray(b)) {
          return {
            role: 'user',
            content: b.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.resultado })),
          };
        }
        if (b.rol === 'usuario') return { role: 'user', content: b.texto };
        if (b.rol === 'asistente') {
          return {
            role: 'assistant',
            content: [
              ...(b.texto ? [{ type: 'text', text: b.texto }] : []),
              ...(b.llamadas ?? []).map((l) => ({
                type: 'tool_use',
                id: l.id,
                name: l.nombre,
                input: l.argumentos,
              })),
            ],
          };
        }
        throw new FallaProveedor('cliente');
      });
      const datos = await enviar(
        c.fetch,
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': c.llave, 'anthropic-version': '2023-06-01' },
        {
          model: modelo,
          max_tokens: TOKENS_SALIDA_MAXIMOS,
          system: [{ type: 'text', text: SISTEMA_EXPLICAR, cache_control: { type: 'ephemeral' } }],
          tools: herramientas.map((h) => ({
            name: h.nombre,
            description: h.descripcion,
            input_schema: h.parametros,
          })),
          tool_choice: { type: forzarRespuesta ? 'none' : 'auto' },
          messages,
          thinking: { type: 'disabled' },
        },
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usage) ? datos.usage : {};
      const bloques = Array.isArray(datos.content) ? datos.content.filter(esObjeto) : [];
      const llamadas: LlamadaHerramienta[] = bloques
        .filter((b) => b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string')
        .map((b) => ({
          id: b.id as string,
          nombre: b.name as string,
          argumentos: esObjeto(b.input) ? b.input : {},
        }));
      const texto = bloques
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('');
      return {
        salida: salida(texto, llamadas, forzarRespuesta),
        tokens_entrada:
          numero(uso.input_tokens) +
          numero(uso.cache_read_input_tokens) +
          numero(uso.cache_creation_input_tokens),
        tokens_salida: numero(uso.output_tokens),
      };
    },
  };
}

function argumentosOpenAI(v: unknown): Objeto {
  if (typeof v !== 'string') return {};
  try {
    const o = JSON.parse(v) as unknown;
    return esObjeto(o) ? o : {};
  } catch {
    return {};
  }
}

export function crearOpenAITurno(c: ConfiguracionTurno): AdaptadorTurno {
  const modelo = c.modelo ?? MODELO_POR_OMISION.openai;
  return {
    nombre: 'openai',
    modelo,
    async llamar({ mensajes, herramientas, forzarRespuesta, senal }) {
      const messages: unknown[] = [{ role: 'system', content: SISTEMA_EXPLICAR }];
      for (const m of mensajes) {
        if (m.rol === 'usuario') messages.push({ role: 'user', content: m.texto });
        else if (m.rol === 'asistente') {
          messages.push({
            role: 'assistant',
            content: m.texto ?? null,
            tool_calls: (m.llamadas ?? []).map((l) => ({
              id: l.id,
              type: 'function',
              function: { name: l.nombre, arguments: JSON.stringify(l.argumentos) },
            })),
          });
        } else messages.push({ role: 'tool', tool_call_id: m.id, content: m.resultado });
      }
      const datos = await enviar(
        c.fetch,
        'https://api.openai.com/v1/chat/completions',
        { authorization: `Bearer ${c.llave}` },
        {
          model: modelo,
          messages,
          tools: herramientas.map((h) => ({
            type: 'function',
            function: { name: h.nombre, description: h.descripcion, parameters: h.parametros },
          })),
          tool_choice: forzarRespuesta ? 'none' : 'auto',
          max_completion_tokens: TOKENS_SALIDA_MAXIMOS,
          store: false,
        },
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usage) ? datos.usage : {};
      const opcion = Array.isArray(datos.choices) && esObjeto(datos.choices[0]) ? datos.choices[0] : {};
      const mensaje = esObjeto(opcion.message) ? opcion.message : {};
      const llamadas: LlamadaHerramienta[] = (
        Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls.filter(esObjeto) : []
      )
        .filter((t) => typeof t.id === 'string' && esObjeto(t.function))
        .flatMap((t) => {
          const f = t.function as Objeto;
          return typeof f.name === 'string'
            ? [{ id: t.id as string, nombre: f.name, argumentos: argumentosOpenAI(f.arguments) }]
            : [];
        });
      return {
        salida: salida(typeof mensaje.content === 'string' ? mensaje.content : '', llamadas, forzarRespuesta),
        tokens_entrada: numero(uso.prompt_tokens),
        tokens_salida: numero(uso.completion_tokens),
      };
    },
  };
}

export function crearGoogleTurno(c: ConfiguracionTurno): AdaptadorTurno {
  const modelo = c.modelo ?? MODELO_POR_OMISION.google;
  return {
    nombre: 'google',
    modelo,
    async llamar({ mensajes, herramientas, forzarRespuesta, senal }) {
      const contents = enBloques(mensajes).map((b) => {
        if (Array.isArray(b)) {
          return {
            role: 'user',
            parts: b.map((r) => ({
              functionResponse: { name: r.nombre, response: { resultado: r.resultado } },
            })),
          };
        }
        if (b.rol === 'usuario') return { role: 'user', parts: [{ text: b.texto }] };
        if (b.rol === 'asistente') {
          return {
            role: 'model',
            parts: [
              ...(b.texto ? [{ text: b.texto }] : []),
              ...(b.llamadas ?? []).map((l) => ({ functionCall: { name: l.nombre, args: l.argumentos } })),
            ],
          };
        }
        throw new FallaProveedor('cliente');
      });
      const datos = await enviar(
        c.fetch,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
        { 'x-goog-api-key': c.llave },
        {
          systemInstruction: { parts: [{ text: SISTEMA_EXPLICAR }] },
          contents,
          tools: [
            {
              functionDeclarations: herramientas.map((h) => ({
                name: h.nombre,
                description: h.descripcion,
                parametersJsonSchema: h.parametros,
              })),
            },
          ],
          toolConfig: { functionCallingConfig: { mode: forzarRespuesta ? 'NONE' : 'AUTO' } },
          generationConfig: { maxOutputTokens: TOKENS_SALIDA_MAXIMOS, thinkingConfig: { thinkingBudget: 0 } },
        },
        senal,
      );
      if (!esObjeto(datos)) throw new FallaProveedor('servidor');
      const uso = esObjeto(datos.usageMetadata) ? datos.usageMetadata : {};
      const candidato =
        Array.isArray(datos.candidates) && esObjeto(datos.candidates[0]) ? datos.candidates[0] : {};
      const contenido = esObjeto(candidato.content) ? candidato.content : {};
      const partes = Array.isArray(contenido.parts) ? contenido.parts.filter(esObjeto) : [];
      // Gemini no siempre pone id a sus llamadas: se numeran después de los resultados que ya hay.
      const base = contarResultados(mensajes);
      const llamadas: LlamadaHerramienta[] = partes
        .map((p) => p.functionCall)
        .filter(esObjeto)
        .filter((f) => typeof f.name === 'string')
        .map((f, i) => ({
          id: typeof f.id === 'string' && /^[\w-]{1,64}$/.test(f.id) ? f.id : `g${base + i + 1}`,
          nombre: f.name as string,
          argumentos: esObjeto(f.args) ? f.args : {},
        }));
      const texto = partes
        .filter((p) => typeof p.text === 'string' && p.thought !== true)
        .map((p) => p.text as string)
        .join('');
      return {
        salida: salida(texto, llamadas, forzarRespuesta),
        tokens_entrada: numero(uso.promptTokenCount),
        tokens_salida: numero(uso.candidatesTokenCount) + numero(uso.thoughtsTokenCount),
      };
    },
  };
}

export const CREADORES_TURNO: Record<NombreProveedor, (c: ConfiguracionTurno) => AdaptadorTurno> = {
  anthropic: crearAnthropicTurno,
  openai: crearOpenAITurno,
  google: crearGoogleTurno,
};
