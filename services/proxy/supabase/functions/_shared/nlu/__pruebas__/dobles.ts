// Dobles de prueba: respuestas con la forma pública de cada API (sin llaves ni red) y un fetch falso que registra
// las peticiones.
import type { ContextoMinimo } from '../contrato.ts';
import type { Fetch } from '../proveedores.ts';

export const CONTEXTO: ContextoMinimo = {
  fecha_referencia: '2026-10-11',
  dia_semana: 'domingo',
  espacios: ['personal'],
  cuentas: [
    { tipo: 'credito', alias: ['nu', 'morada'], espacio: 'personal' },
    { tipo: 'efectivo', alias: ['efectivo', 'cartera'], espacio: 'personal' },
  ],
  contactos: [['jefa', 'mama'], ['juan']],
  ultimo_ingreso: '2026-09-30',
  proximo_ingreso: '2026-10-15',
};

export const INTERPRETACION = {
  intencion: 'registrar',
  movimientos: [
    {
      tipo: 'gasto',
      monto: 9876500,
      fecha: '2026-10-11',
      descripcion: 'tacos',
      categoria: 'comida_fuera',
      origen: { tipo: 'credito', alias: 'nu' },
    },
  ],
};

export function respuestaAnthropic(texto: string, uso = { entrada: 1200, salida: 80 }) {
  return {
    id: 'msg_prueba',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: texto }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: uso.entrada - 1000,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 0,
      output_tokens: uso.salida,
    },
  };
}

export function respuestaOpenAI(texto: string, uso = { entrada: 1300, salida: 90 }) {
  return {
    id: 'chatcmpl-prueba',
    object: 'chat.completion',
    choices: [
      { index: 0, message: { role: 'assistant', content: texto, refusal: null }, finish_reason: 'stop' },
    ],
    usage: {
      prompt_tokens: uso.entrada,
      completion_tokens: uso.salida,
      total_tokens: uso.entrada + uso.salida,
    },
  };
}

export function respuestaGoogle(texto: string, uso = { entrada: 1250, salida: 70, razonamiento: 5 }) {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }],
    usageMetadata: {
      promptTokenCount: uso.entrada,
      candidatesTokenCount: uso.salida,
      thoughtsTokenCount: uso.razonamiento,
    },
  };
}

export interface PeticionRegistrada {
  url: string;
  encabezados: Record<string, string>;
  cuerpo: Record<string, unknown>;
}

/** Fetch falso: cada llamada consume la siguiente respuesta; `'colgar'` no responde hasta que se aborta. */
export function fetchFalso(respuestas: (Response | 'colgar' | 'red')[]) {
  const peticiones: PeticionRegistrada[] = [];
  const fn: Fetch = async (url, init) => {
    peticiones.push({
      url,
      encabezados: Object.fromEntries(new Headers(init.headers).entries()),
      cuerpo: JSON.parse(String(init.body)) as Record<string, unknown>,
    });
    const siguiente = respuestas.shift();
    if (siguiente === undefined) throw new Error('sin respuesta preparada');
    if (siguiente === 'red') throw new TypeError('fetch failed');
    if (siguiente === 'colgar') {
      return new Promise<Response>((_, rechazar) => {
        init.signal?.addEventListener('abort', () => rechazar(new DOMException('abortado', 'AbortError')));
      });
    }
    return siguiente;
  };
  return { fetch: fn, peticiones };
}

export const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

/** Elemento `i` de una lista; falla la prueba si no existe. */
export function en<T>(lista: readonly T[], i: number): T {
  const v = lista[i];
  if (v === undefined) throw new Error(`no hay elemento ${i}`);
  return v;
}
