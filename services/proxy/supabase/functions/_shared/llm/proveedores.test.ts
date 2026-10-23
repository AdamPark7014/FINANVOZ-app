import { describe, expect, it } from 'vitest';
import {
  en,
  fetchFalso,
  json,
  respuestaAnthropic,
  respuestaGoogle,
  respuestaOpenAI,
} from '../nlu/__pruebas__/dobles.ts';
import { FallaProveedor } from '../nlu/proveedores.ts';
import type { DefinicionHerramienta, MensajeTurno } from './contrato.ts';
import { SISTEMA_EXPLICAR } from './prompt.ts';
import { crearAnthropicTurno, crearGoogleTurno, crearOpenAITurno } from './proveedores.ts';

const HERRAMIENTAS: DefinicionHerramienta[] = [
  {
    nombre: 'gasto',
    descripcion: 'Gasto en un periodo.',
    parametros: { type: 'object', properties: { desde: { type: 'string' } } },
  },
];
const PREGUNTA: MensajeTurno = { rol: 'usuario', texto: '¿por qué no me alcanzó?' };
const CONVERSACION: MensajeTurno[] = [
  PREGUNTA,
  { rol: 'asistente', llamadas: [{ id: 'a1', nombre: 'gasto', argumentos: { desde: '2026-09-15' } }] },
  { rol: 'herramienta', id: 'a1', nombre: 'gasto', resultado: '{"texto":"Gastaste $6,430."}' },
];
const senal = () => new AbortController().signal;
const base = { herramientas: HERRAMIENTAS, forzarRespuesta: false };

describe('Anthropic (tool_use)', () => {
  it('manda herramientas, sistema fijo en caché y traduce llamadas y resultados', async () => {
    const f = fetchFalso([json(respuestaAnthropic('Gastaste $6,430.'))]);
    const a = crearAnthropicTurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, mensajes: CONVERSACION, senal: senal() });
    expect(r).toEqual({
      salida: { tipo: 'respuesta', texto: 'Gastaste $6,430.' },
      tokens_entrada: 1200,
      tokens_salida: 80,
      tokens_cache_leidos: 1000,
      tokens_cache_escritos: 0,
    });
    const peticion = en(f.peticiones, 0);
    expect(peticion.url).toBe('https://api.anthropic.com/v1/messages');
    expect(peticion.encabezados['anthropic-version']).toBe('2026-10-21');
    const p = peticion.cuerpo;
    expect(p.model).toBe('claude-haiku-5-5');
    for (const prohibido of ['temperature', 'top_p', 'top_k']) expect(p).not.toHaveProperty(prohibido);
    expect(p.system).toEqual([
      { type: 'text', text: SISTEMA_EXPLICAR, cache_control: { type: 'ephemeral' } },
    ]);
    expect(p.tools).toEqual([
      { name: 'gasto', description: 'Gasto en un periodo.', input_schema: HERRAMIENTAS[0]?.parametros },
    ]);
    expect(p.tool_choice).toEqual({ type: 'auto' });
    expect(p.thinking).toEqual({ type: 'disabled' });
    expect(p.output_config).toEqual({ effort: 'low' });
    expect(p.messages).toEqual([
      { role: 'user', content: PREGUNTA.rol === 'usuario' ? PREGUNTA.texto : '' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'a1', name: 'gasto', input: { desde: '2026-09-15' } }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'a1', content: '{"texto":"Gastaste $6,430."}' }],
      },
    ]);
  });

  it('la fecha de hoy va en un bloque aparte, después del corte de caché; la raíz de la API es configurable', async () => {
    const f = fetchFalso([json(respuestaAnthropic('ok'))]);
    const a = crearAnthropicTurno({ llave: 'tok', fetch: f.fetch, urlBase: 'https://ia.zynoratek.com' });
    await a.llamar({ ...base, mensajes: [PREGUNTA], fecha: 'Hoy es jueves 2026-10-22.', senal: senal() });
    const p = en(f.peticiones, 0);
    expect(p.url).toBe('https://ia.zynoratek.com/v1/messages');
    expect(p.cuerpo.system).toEqual([
      { type: 'text', text: SISTEMA_EXPLICAR, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'Hoy es jueves 2026-10-22.' },
    ]);
  });

  it('con Sonnet 5.5 apaga el razonamiento con between_tools (disabled da 400)', async () => {
    const f = fetchFalso([json(respuestaAnthropic('ok'))]);
    const a = crearAnthropicTurno({ llave: 'k', fetch: f.fetch, modelo: 'claude-sonnet-5-5' });
    await a.llamar({ ...base, mensajes: [PREGUNTA], senal: senal() });
    expect(en(f.peticiones, 0).cuerpo.thinking).toEqual({ type: 'between_tools' });
  });

  it('lee las llamadas a herramientas; con 3 resultados fuerza la respuesta (tool_choice none)', async () => {
    const conLlamada = {
      ...respuestaAnthropic(''),
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'gasto', input: { desde: '2026-10-01' } }],
    };
    const f = fetchFalso([json(conLlamada), json(conLlamada)]);
    const a = crearAnthropicTurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, mensajes: [PREGUNTA], senal: senal() });
    expect(r.salida).toEqual({
      tipo: 'herramientas',
      llamadas: [{ id: 'toolu_1', nombre: 'gasto', argumentos: { desde: '2026-10-01' } }],
    });
    const forzada = await a.llamar({ ...base, forzarRespuesta: true, mensajes: [PREGUNTA], senal: senal() });
    expect(forzada.salida).toEqual({ tipo: 'respuesta', texto: '' });
    expect(en(f.peticiones, 1).cuerpo.tool_choice).toEqual({ type: 'none' });
  });

  it('un 5xx es FallaProveedor servidor sin el cuerpo', async () => {
    const f = fetchFalso([json({ error: 'detalle con datos' }, 529)]);
    const a = crearAnthropicTurno({ llave: 'k', fetch: f.fetch });
    const e = await a.llamar({ ...base, mensajes: [PREGUNTA], senal: senal() }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(FallaProveedor);
    expect(String(e)).not.toContain('detalle');
  });

  it('un rechazo de seguridad (stop_reason refusal) es falla del servidor para que intente el alterno', async () => {
    const f = fetchFalso([json({ ...respuestaAnthropic(''), content: [], stop_reason: 'refusal' })]);
    const a = crearAnthropicTurno({ llave: 'k', fetch: f.fetch });
    await expect(a.llamar({ ...base, mensajes: [PREGUNTA], senal: senal() })).rejects.toMatchObject({
      tipo: 'servidor',
    });
  });
});

describe('OpenAI (tool_calls)', () => {
  it('traduce la conversación y lee tool_calls con argumentos en JSON', async () => {
    const respuesta = respuestaOpenAI('');
    const mensaje = en(respuesta.choices, 0).message as Record<string, unknown>;
    mensaje.content = null;
    mensaje.tool_calls = [
      { id: 'call_1', type: 'function', function: { name: 'gasto', arguments: '{"desde":"2026-10-01"}' } },
      { id: 'call_2', type: 'function', function: { name: 'gasto', arguments: 'no json' } },
    ];
    const f = fetchFalso([json(respuesta)]);
    const a = crearOpenAITurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, mensajes: CONVERSACION, senal: senal() });
    expect(r.salida).toEqual({
      tipo: 'herramientas',
      llamadas: [
        { id: 'call_1', nombre: 'gasto', argumentos: { desde: '2026-10-01' } },
        { id: 'call_2', nombre: 'gasto', argumentos: {} },
      ],
    });
    const p = en(f.peticiones, 0).cuerpo;
    expect(p.store).toBe(false);
    expect(p.reasoning_effort).toBe('low');
    expect(p.tool_choice).toBe('auto');
    expect(p.messages).toEqual([
      { role: 'system', content: SISTEMA_EXPLICAR },
      { role: 'user', content: '¿por qué no me alcanzó?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'a1', type: 'function', function: { name: 'gasto', arguments: '{"desde":"2026-09-15"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'a1', content: '{"texto":"Gastaste $6,430."}' },
    ]);
    expect(p.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'gasto',
          description: 'Gasto en un periodo.',
          parameters: HERRAMIENTAS[0]?.parametros,
        },
      },
    ]);
  });

  it('respuesta de texto', async () => {
    const f = fetchFalso([json(respuestaOpenAI(' Gastaste $6,430. '))]);
    const a = crearOpenAITurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, forzarRespuesta: true, mensajes: CONVERSACION, senal: senal() });
    expect(r.salida).toEqual({ tipo: 'respuesta', texto: 'Gastaste $6,430.' });
    expect(en(f.peticiones, 0).cuerpo.tool_choice).toBe('none');
  });
});

describe('Google (functionCall)', () => {
  it('traduce a functionCall/functionResponse y numera las llamadas sin id', async () => {
    const respuesta = respuestaGoogle('');
    const contenido = en(respuesta.candidates, 0).content as { parts: unknown[] };
    contenido.parts = [{ functionCall: { name: 'gasto', args: { desde: '2026-10-01' } } }];
    const f = fetchFalso([json(respuesta)]);
    const a = crearGoogleTurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, mensajes: CONVERSACION, senal: senal() });
    expect(r.salida).toEqual({
      tipo: 'herramientas',
      llamadas: [{ id: 'g2', nombre: 'gasto', argumentos: { desde: '2026-10-01' } }],
    });
    const p = en(f.peticiones, 0).cuerpo;
    expect(p.contents).toEqual([
      { role: 'user', parts: [{ text: '¿por qué no me alcanzó?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'gasto', args: { desde: '2026-09-15' } } }] },
      {
        role: 'user',
        parts: [
          { functionResponse: { name: 'gasto', response: { resultado: '{"texto":"Gastaste $6,430."}' } } },
        ],
      },
    ]);
    expect(p.toolConfig).toEqual({ functionCallingConfig: { mode: 'AUTO' } });
    expect(p.systemInstruction).toEqual({ parts: [{ text: SISTEMA_EXPLICAR }] });
  });

  it('respuesta de texto sin las partes de razonamiento', async () => {
    const respuesta = respuestaGoogle('');
    const contenido = en(respuesta.candidates, 0).content as { parts: unknown[] };
    contenido.parts = [{ text: 'pensando', thought: true }, { text: 'Gastaste $6,430.' }];
    const f = fetchFalso([json(respuesta)]);
    const a = crearGoogleTurno({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ ...base, mensajes: CONVERSACION, senal: senal() });
    expect(r.salida).toEqual({ tipo: 'respuesta', texto: 'Gastaste $6,430.' });
    expect(r.tokens_salida).toBe(75);
  });
});
