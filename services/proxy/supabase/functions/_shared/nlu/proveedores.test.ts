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
import { construirPrompt, FORMATO_JSON } from './prompt.ts';
import {
  abrirTextoJson,
  crearAnthropic,
  crearGoogle,
  crearOpenAI,
  ESQUEMA_HERRAMIENTA_MINIMA,
  FallaProveedor,
  leerModoAnthropic,
  modoParaModelo,
  pensamientoMinimo,
  urlMensajesAnthropic,
  usoAnthropic,
} from './proveedores.ts';

const prompt = construirPrompt('unos tacos con la nu', CONTEXTO);
const senal = () => new AbortController().signal;
const salida = JSON.stringify({ interpretacion: INTERPRETACION });

describe('Anthropic (Messages API)', () => {
  const herramienta = (input: unknown) => ({
    ...respuestaAnthropic(''),
    content: [{ type: 'tool_use', id: 't1', name: 'interpretacion', input }],
    stop_reason: 'tool_use',
  });

  it('por omisión: herramienta forzada, API 2026-10-21, esfuerzo low, sin razonamiento y sistema en caché', async () => {
    const f = fetchFalso([json(herramienta({ interpretacion: INTERPRETACION }))]);
    const a = crearAnthropic({ llave: 'llave-de-prueba', fetch: f.fetch });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(JSON.parse(r.texto)).toEqual({ interpretacion: INTERPRETACION });
    expect(r).toMatchObject({ tokens_entrada: 1200, tokens_salida: 80, tokens_cache_leidos: 1000 });

    const p = en(f.peticiones, 0);
    expect(p.url).toBe('https://api.anthropic.com/v1/messages');
    expect(p.encabezados['x-api-key']).toBe('llave-de-prueba');
    expect(p.encabezados['anthropic-version']).toBe('2026-10-21');
    expect(p.cuerpo.model).toBe('claude-haiku-5-5');
    expect(p.cuerpo.max_tokens).toBe(1024);
    expect(p.cuerpo.output_config).toEqual({ effort: 'low' });
    expect(p.cuerpo.thinking).toEqual({ type: 'disabled' });
    for (const prohibido of ['temperature', 'top_p', 'top_k']) expect(p.cuerpo).not.toHaveProperty(prohibido);
    const tools = p.cuerpo.tools as { input_schema: unknown }[];
    expect(en(tools, 0).input_schema).toEqual(esquemas.estandar);
    expect(p.cuerpo.tool_choice).toEqual({ type: 'tool', name: 'interpretacion' });
    // Herramienta + sistema fijos antes del corte; el contexto del usuario va después, en el mensaje.
    expect(p.cuerpo.system).toEqual([
      { type: 'text', text: prompt.sistema, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ]);
    expect(p.cuerpo.messages).toEqual([{ role: 'user', content: prompt.usuario }]);
    // La puerta separa el gasto por función; Anthropic no lo recibe (la puerta no lo reenvía).
    expect(p.encabezados['x-proceso']).toBe('finanvoz-interpretar');
  });

  it('modo herramienta_minima: herramienta forzada de una propiedad y la forma en el sistema cacheado', async () => {
    const f = fetchFalso([json(herramienta({ interpretacion: INTERPRETACION }))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch, modoAnthropic: 'herramienta_minima' });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(JSON.parse(r.texto)).toEqual({ interpretacion: INTERPRETACION });
    const p = en(f.peticiones, 0);
    const tools = p.cuerpo.tools as { input_schema: unknown }[];
    expect(en(tools, 0).input_schema).toEqual(ESQUEMA_HERRAMIENTA_MINIMA);
    expect(p.cuerpo.tool_choice).toEqual({ type: 'tool', name: 'interpretacion' });
    expect(p.cuerpo.system).toEqual([
      {
        type: 'text',
        text: `${prompt.sistema}\n\n${FORMATO_JSON}`,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ]);
    // La proyección completa (~9,700 tokens de JSON denso) se cambia por ~1,000 de FORMATO_JSON.
    expect(JSON.stringify(ESQUEMA_HERRAMIENTA_MINIMA).length * 20).toBeLessThan(
      JSON.stringify(esquemas.estandar).length,
    );
    expect(FORMATO_JSON.length * 3).toBeLessThan(JSON.stringify(esquemas.estandar).length);
    expect(modoParaModelo('herramienta_minima', 'claude-sonnet-5-5')).toBe('texto');
    expect(leerModoAnthropic('herramienta_minima')).toBe('herramienta_minima');
  });

  it('modo json_schema: output_config.format con la proyección estándar y sin herramientas', async () => {
    const f = fetchFalso([json(respuestaAnthropic(salida))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch, modoAnthropic: 'json_schema' });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(r.texto).toBe(salida);
    const p = en(f.peticiones, 0);
    expect(p.cuerpo.output_config).toEqual({
      effort: 'low',
      format: { type: 'json_schema', schema: esquemas.estandar },
    });
    expect(p.cuerpo).not.toHaveProperty('tools');
  });

  it('modo texto: la forma va en el sistema cacheado y se saca el JSON aunque venga en un bloque de código', async () => {
    const f = fetchFalso([json(respuestaAnthropic(`\`\`\`json\n${salida}\n\`\`\``))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch, modoAnthropic: 'texto' });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(r.texto).toBe(salida);
    const p = en(f.peticiones, 0);
    expect(p.cuerpo).not.toHaveProperty('tools');
    expect(p.cuerpo.output_config).toEqual({ effort: 'low' });
    expect(p.cuerpo.system).toEqual([
      {
        type: 'text',
        text: `${prompt.sistema}\n\n${FORMATO_JSON}`,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ]);
  });

  it('ANTHROPIC_BASE_URL: la misma petición a la raíz configurada (puerta única)', async () => {
    const f = fetchFalso([json(herramienta({ interpretacion: INTERPRETACION }))]);
    const a = crearAnthropic({
      llave: 'token-proyecto',
      fetch: f.fetch,
      urlBase: 'https://ia.zynoratek.com/',
    });
    await a.llamar({ prompt, senal: senal() });
    const p = en(f.peticiones, 0);
    expect(p.url).toBe('https://ia.zynoratek.com/v1/messages');
    expect(p.encabezados['x-api-key']).toBe('token-proyecto');
    expect(urlMensajesAnthropic()).toBe('https://api.anthropic.com/v1/messages');
  });

  it('abre `interpretacion` mandada como texto JSON, aunque traiga una llave de más, sin gastar el reintento', async () => {
    const comoTexto = `${JSON.stringify(INTERPRETACION)}}`;
    const f = fetchFalso([json(herramienta({ interpretacion: comoTexto }))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    const r = await a.llamar({ prompt, senal: senal() });
    expect(JSON.parse(r.texto)).toEqual({ interpretacion: INTERPRETACION });
    expect(abrirTextoJson('no es json {')).toBe('no es json {');
    expect(abrirTextoJson('{roto')).toBe('{roto');
  });

  it('separa la caché leída y escrita del uso', () => {
    expect(
      usoAnthropic({
        input_tokens: 200,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 100,
        output_tokens: 50,
      }),
    ).toEqual({
      tokens_entrada: 1200,
      tokens_salida: 50,
      tokens_cache_leidos: 900,
      tokens_cache_escritos: 100,
    });
  });

  it('con Sonnet 5.5 no manda lo que rechaza: thinking between_tools y sin herramienta forzada (modo texto)', async () => {
    const f = fetchFalso([json(respuestaAnthropic(salida))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch, modelo: 'claude-sonnet-5-5' });
    await a.llamar({ prompt, senal: senal() });
    const p = en(f.peticiones, 0);
    expect(p.cuerpo.thinking).toEqual({ type: 'between_tools' });
    expect(p.cuerpo).not.toHaveProperty('tool_choice');
    expect(modoParaModelo('herramienta', 'claude-haiku-5-5')).toBe('herramienta');
    expect(pensamientoMinimo('claude-haiku-5-5')).toEqual({ type: 'disabled' });
  });

  it('NLU_ANTHROPIC_MODO: valores conocidos o el modo por omisión', () => {
    expect(leerModoAnthropic('texto')).toBe('texto');
    expect(leerModoAnthropic('json_schema')).toBe('json_schema');
    expect(leerModoAnthropic(undefined)).toBe('herramienta');
    expect(leerModoAnthropic('otro')).toBe('herramienta');
  });

  it('un rechazo de seguridad (stop_reason refusal) es falla del servidor para que intente el alterno', async () => {
    const f = fetchFalso([json({ ...respuestaAnthropic(''), content: [], stop_reason: 'refusal' })]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    await expect(a.llamar({ prompt, senal: senal() })).rejects.toMatchObject({ tipo: 'servidor' });
  });

  it('stop_reason max_tokens marca la respuesta como cortada; las demás no', async () => {
    const f = fetchFalso([
      json({ ...herramienta({ interpretacion: {} }), stop_reason: 'max_tokens' }),
      json(herramienta({ interpretacion: INTERPRETACION })),
    ]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    expect(await a.llamar({ prompt, senal: senal() })).toMatchObject({ cortada: true });
    expect(await a.llamar({ prompt, senal: senal() })).not.toHaveProperty('cortada');
  });

  it('una salida anterior vacía va al reintento con un marcador (la API rechaza el turno vacío)', async () => {
    const f = fetchFalso([json(respuestaAnthropic(salida))]);
    const a = crearAnthropic({ llave: 'k', fetch: f.fetch });
    await a.llamar({ prompt, reintento: { salidaAnterior: '  ', correccion: 'corrige' }, senal: senal() });
    expect(en(f.peticiones, 0).cuerpo.messages).toContainEqual({
      role: 'assistant',
      content: '(sin respuesta)',
    });
  });

  it('el reintento agrega la salida anterior y la corrección, y termina en un turno del usuario', async () => {
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
