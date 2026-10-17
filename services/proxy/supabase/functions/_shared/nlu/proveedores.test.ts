import { describe, expect, it } from 'vitest';
import esquemas from '../esquema-proveedor.json' with { type: 'json' };
import {
  CONTEXTO,
  en,
  fetchFalso,
  INTERPRETACION,
  json,
  respuestaAnthropic,
  respuestaGoogle,
  respuestaOpenAI,
} from './__pruebas__/dobles.ts';
import { construirPrompt } from './prompt.ts';
import { crearAnthropic, crearGoogle, crearOpenAI, FallaProveedor } from './proveedores.ts';

const prompt = construirPrompt('unos tacos con la nu', CONTEXTO);
const senal = () => new AbortController().signal;
const salida = JSON.stringify({ interpretacion: INTERPRETACION });

describe('Anthropic (Messages API)', () => {
  it('pide salida estructurada con la proyección estándar, sistema en caché y modelo claude-haiku-5-5', async () => {
    const f = fetchFalso([json(respuestaAnthropic(salida))]);
    const a = crearAnthropic({ llave: 'llave-de-prueba', fetch: f.fetch });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(r).toEqual({ texto: salida, tokens_entrada: 1200, tokens_salida: 80 });

    const p = en(f.peticiones, 0);
    expect(p.url).toBe('https://api.anthropic.com/v1/messages');
    expect(p.encabezados['x-api-key']).toBe('llave-de-prueba');
    expect(p.encabezados['anthropic-version']).toBe('2023-06-01');
    expect(p.cuerpo.model).toBe('claude-haiku-5-5');
    expect(p.cuerpo.output_config).toEqual({
      effort: 'medium',
      format: { type: 'json_schema', schema: esquemas.estandar },
    });
    expect(p.cuerpo.thinking).toEqual({ type: 'disabled' });
    expect(p.cuerpo).not.toHaveProperty('temperature');
    expect(p.cuerpo.system).toEqual([
      { type: 'text', text: prompt.sistema, cache_control: { type: 'ephemeral' } },
    ]);
    expect(p.cuerpo.messages).toEqual([{ role: 'user', content: prompt.usuario }]);
  });

  it('modo herramienta: input_schema y lectura del bloque tool_use', async () => {
    const respuesta = {
      ...respuestaAnthropic(''),
      content: [
        { type: 'tool_use', id: 't1', name: 'interpretacion', input: { interpretacion: INTERPRETACION } },
      ],
    };
    const f = fetchFalso([json(respuesta)]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch, modoAnthropic: 'herramienta' });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(JSON.parse(r.texto)).toEqual({ interpretacion: INTERPRETACION });
    const tools = en(f.peticiones, 0).cuerpo.tools as { input_schema: unknown }[];
    expect(en(tools, 0).input_schema).toEqual(esquemas.estandar);
    expect(en(f.peticiones, 0).cuerpo.tool_choice).toEqual({ type: 'tool', name: 'interpretacion' });
    expect(en(f.peticiones, 0).cuerpo.output_config).toEqual({ effort: 'medium' });
  });

  it('un rechazo de seguridad (stop_reason refusal) es falla del servidor para que intente el alterno', async () => {
    const f = fetchFalso([json({ ...respuestaAnthropic(''), content: [], stop_reason: 'refusal' })]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    await expect(a.llamar({ prompt, senal: senal() })).rejects.toMatchObject({ tipo: 'servidor' });
  });

  it('el reintento agrega la salida anterior y la corrección', async () => {
    const f = fetchFalso([json(respuestaAnthropic(salida))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    await a.llamar({ prompt, reintento: { salidaAnterior: '{}', correccion: 'corrige' }, senal: senal() });
    expect(en(f.peticiones, 0).cuerpo.messages).toEqual([
      { role: 'user', content: prompt.usuario },
      { role: 'assistant', content: '{}' },
      { role: 'user', content: 'corrige' },
    ]);
  });
});

describe('OpenAI (Chat Completions)', () => {
  it('json_schema estricto con la variante nulable y sin almacenamiento', async () => {
    const f = fetchFalso([json(respuestaOpenAI(salida))]);
    const a = crearOpenAI({ llave: 'llave-o', fetch: f.fetch, modelo: 'modelo-mini' });
    expect(a.nulable).toBe(true);
    const r = await a.llamar({ prompt, senal: senal() });
    expect(r).toEqual({ texto: salida, tokens_entrada: 1300, tokens_salida: 90 });
    const p = en(f.peticiones, 0);
    expect(p.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(p.encabezados.authorization).toBe('Bearer llave-o');
    expect(p.cuerpo.model).toBe('modelo-mini');
    expect(p.cuerpo.store).toBe(false);
    expect(p.cuerpo.reasoning_effort).toBe('low');
    expect(p.cuerpo.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'interpretacion', strict: true, schema: esquemas.nulable },
    });
    expect(p.cuerpo.messages).toEqual([
      { role: 'system', content: prompt.sistema },
      { role: 'user', content: prompt.usuario },
    ]);
  });
});

describe('Google (Gemini generateContent)', () => {
  it('responseJsonSchema con la proyección estándar; los tokens de razonamiento cuentan como salida', async () => {
    const f = fetchFalso([json(respuestaGoogle(salida))]);
    const a = crearGoogle({ llave: 'llave-g', fetch: f.fetch });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(r).toEqual({ texto: salida, tokens_entrada: 1250, tokens_salida: 75 });
    const p = en(f.peticiones, 0);
    expect(p.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(p.encabezados['x-goog-api-key']).toBe('llave-g');
    expect(p.cuerpo.systemInstruction).toEqual({ parts: [{ text: prompt.sistema }] });
    expect(p.cuerpo.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: esquemas.estandar,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });
});

describe('fallas (sin cuerpo en el error)', () => {
  const casos = [
    ['5xx', json({ error: { message: 'texto secreto' } }, 503), 'servidor', 503],
    ['429', json({}, 429), 'servidor', 429],
    ['400', json({ error: 'esquema' }, 400), 'cliente', 400],
  ] as const;
  for (const [nombre, respuesta, tipo, estado] of casos) {
    it(`${nombre} → ${tipo}`, async () => {
      const f = fetchFalso([respuesta]);
      const a = crearOpenAI({ llave: 'k', fetch: f.fetch });
      const e = await a.llamar({ prompt, senal: senal() }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(FallaProveedor);
      expect(e).toMatchObject({ tipo, estado });
      expect(String((e as Error).message)).not.toContain('secreto');
    });
  }

  it('error de red → servidor; abortado → tiempo', async () => {
    const a = crearGoogle({ llave: 'k', fetch: fetchFalso(['red']).fetch });
    await expect(a.llamar({ prompt, senal: senal() })).rejects.toMatchObject({ tipo: 'servidor' });

    const control = new AbortController();
    const b = crearGoogle({ llave: 'k', fetch: fetchFalso(['colgar']).fetch });
    const promesa = b.llamar({ prompt, senal: control.signal });
    control.abort();
    await expect(promesa).rejects.toMatchObject({ tipo: 'tiempo' });
  });
});
