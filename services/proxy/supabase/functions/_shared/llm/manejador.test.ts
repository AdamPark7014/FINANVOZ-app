// M10 · `/llm/turno`: autenticación, Plus, cupo, contrato, alterno y registros sin contenido (regla 9).
import { describe, expect, it } from 'vitest';
import { fetchFalso, json, respuestaAnthropic, respuestaOpenAI } from '../nlu/__pruebas__/dobles.ts';
import { type EventoRegistro, hashUsuario, lineaRegistro } from '../nlu/registro.ts';
import { crearManejadorTurno, type ResultadoCupoTurno } from './manejador.ts';
import { crearAnthropicTurno, crearOpenAITurno } from './proveedores.ts';
import { turno } from './turno.ts';

const JWT = 'jwt.valido.firma';
const USUARIO = 'usuario-plus-1';
// Nada de esto puede llegar a un registro: pregunta, alias, montos, resultados, argumentos, texto del modelo.
const PROHIBIDOS = [
  'preguntamarcador',
  'nubankmarcador',
  '98765',
  'resultadomarcador',
  'respuestamarcador',
  JWT,
  USUARIO,
];

const HERRAMIENTAS = [
  {
    nombre: 'gasto',
    descripcion: 'Gasto en un periodo.',
    parametros: { type: 'object', properties: { alias: { type: 'string' } } },
  },
];
const PRIMERA = {
  mensajes: [{ rol: 'usuario', texto: '¿por qué preguntamarcador no me alcanzó con la nubankmarcador?' }],
  herramientas: HERRAMIENTAS,
};
const SEGUNDA = {
  mensajes: [
    ...PRIMERA.mensajes,
    { rol: 'asistente', llamadas: [{ id: 'a1', nombre: 'gasto', argumentos: { alias: 'nubankmarcador' } }] },
    { rol: 'herramienta', id: 'a1', nombre: 'gasto', resultado: '{"texto":"resultadomarcador $98,765"}' },
  ],
  herramientas: HERRAMIENTAS,
};

function solicitud(cuerpo: unknown, jwt: string | null = JWT, metodo = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (jwt !== null) headers.authorization = `Bearer ${jwt}`;
  return new Request('https://proxy.prueba/functions/v1/llm-turno', {
    method: metodo,
    headers,
    ...(metodo === 'POST' ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}),
  });
}

const conLlamada = () => ({
  ...respuestaAnthropic(''),
  content: [{ type: 'tool_use', id: 'toolu_1', name: 'gasto', input: { alias: 'nubankmarcador' } }],
});

function armar(
  opciones: {
    cupo?: ResultadoCupoTurno;
    principal?: Parameters<typeof fetchFalso>[0];
    alterno?: Parameters<typeof fetchFalso>[0];
  } = {},
) {
  const eventos: EventoRegistro[] = [];
  const lineas: string[] = [];
  const consumidos: string[] = [];
  const devueltos: string[] = [];
  const principal = fetchFalso(opciones.principal ?? [json(conLlamada())]);
  const alterno = fetchFalso(opciones.alterno ?? []);
  const manejador = crearManejadorTurno({
    configurado: true,
    verificarUsuario: async (jwt) => (jwt === JWT ? USUARIO : null),
    consumirCupo: async (id) => {
      consumidos.push(id);
      return opciones.cupo ?? 'ok';
    },
    devolverCupo: async (id) => {
      devueltos.push(id);
    },
    turno: (s) =>
      turno(s, {
        adaptadores: [
          crearAnthropicTurno({ llave: 'k', fetch: principal.fetch }),
          crearOpenAITurno({ llave: 'k', fetch: alterno.fetch }),
        ],
        tiempoMaximoMs: 30,
        ahora: () => 0,
      }),
    hashUsuario: (id) => hashUsuario(id, 'sal'),
    registrar: (e) => {
      eventos.push(e);
      lineas.push(lineaRegistro(e));
    },
  });
  return { manejador, eventos, lineas, consumidos, devueltos, principal, alterno };
}

const cuerpo = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe('/llm/turno · acceso', () => {
  it('401 sin JWT o con JWT inválido, sin consumir cupo', async () => {
    const a = armar();
    expect((await a.manejador(solicitud(PRIMERA, null))).status).toBe(401);
    expect((await a.manejador(solicitud(PRIMERA, 'otro'))).status).toBe(401);
    expect(a.consumidos).toEqual([]);
  });

  it('403 solo_plus en Gratis, sin llamar al proveedor', async () => {
    const a = armar({ cupo: 'solo_plus', principal: [] });
    const r = await a.manejador(solicitud(PRIMERA));
    expect(r.status).toBe(403);
    expect(await cuerpo(r)).toEqual({ error: 'solo_plus' });
    expect(a.principal.peticiones).toHaveLength(0);
  });

  it.each(['limite_diario', 'limite_mensual', 'tope_global'] as const)('429 %s', async (codigo) => {
    const a = armar({ cupo: codigo, principal: [] });
    const r = await a.manejador(solicitud(PRIMERA));
    expect(r.status).toBe(429);
    expect(await cuerpo(r)).toEqual({ error: codigo });
  });

  it('405 con otro método y 400 con un cuerpo fuera del contrato (sin consumir)', async () => {
    const a = armar({ principal: [] });
    expect((await a.manejador(solicitud(null, JWT, 'GET'))).status).toBe(405);
    expect((await a.manejador(solicitud('no json'))).status).toBe(400);
    expect((await a.manejador(solicitud({ ...PRIMERA, sistema: 'x' }))).status).toBe(400);
    expect((await a.manejador(solicitud({ ...PRIMERA, relleno: 'x'.repeat(40_000) }))).status).toBe(400);
    expect(a.consumidos).toEqual([]);
  });
});

describe('/llm/turno · contrato (03 §6)', () => {
  it('primera vuelta: el modelo pide herramientas; cada turno consume una interpretación', async () => {
    const a = armar();
    const r = await a.manejador(solicitud(PRIMERA));
    expect(r.status).toBe(200);
    expect(await cuerpo(r)).toEqual({
      salida: {
        tipo: 'herramientas',
        llamadas: [{ id: 'toolu_1', nombre: 'gasto', argumentos: { alias: 'nubankmarcador' } }],
      },
      proveedor: 'anthropic',
      modelo: 'claude-haiku-5-5',
      tokens_entrada: 1200,
      tokens_salida: 80,
      latencia_ms: 0,
    });
    expect(a.consumidos).toEqual([USUARIO]);
    expect(a.eventos[0]).toMatchObject({ endpoint: '/llm/turno', codigo: 'herramientas', estado_http: 200 });
  });

  it('segunda vuelta con resultados: respuesta del asistente', async () => {
    const a = armar({ principal: [json(respuestaAnthropic('respuestamarcador $98,765'))] });
    const r = await a.manejador(solicitud(SEGUNDA));
    expect((await cuerpo(r)).salida).toEqual({ tipo: 'respuesta', texto: 'respuestamarcador $98,765' });
    expect(a.eventos[0]).toMatchObject({ codigo: 'respuesta' });
  });

  it('ante un 5xx del principal responde el alterno', async () => {
    const a = armar({ principal: [json({}, 503)], alterno: [json(respuestaOpenAI('respuestamarcador'))] });
    const r = await a.manejador(solicitud(SEGUNDA));
    expect(r.status).toBe(200);
    expect(await cuerpo(r)).toMatchObject({ proveedor: 'openai', salida: { tipo: 'respuesta' } });
    expect(a.eventos[0]).toMatchObject({ llamadas: 2 });
  });

  it('502 y 504 devuelven el cupo', async () => {
    const a = armar({ principal: [json({}, 500)], alterno: ['red'] });
    expect((await a.manejador(solicitud(PRIMERA))).status).toBe(502);
    const b = armar({ principal: ['colgar'], alterno: ['colgar'] });
    expect((await b.manejador(solicitud(PRIMERA))).status).toBe(504);
    expect([...a.devueltos, ...b.devueltos]).toEqual([USUARIO, USUARIO]);
  });

  it('un 4xx del principal no intenta el alterno', async () => {
    const a = armar({ principal: [json({}, 400)], alterno: [json(respuestaOpenAI('x'))] });
    expect((await a.manejador(solicitud(PRIMERA))).status).toBe(502);
    expect(a.alterno.peticiones).toHaveLength(0);
  });
});

describe('/llm/turno · privacidad (regla 9)', () => {
  it('ningún registro contiene la pregunta, alias, montos, resultados, argumentos ni la respuesta', async () => {
    const a = armar({
      principal: [json(conLlamada()), json(respuestaAnthropic('respuestamarcador $98,765')), json({}, 500)],
      alterno: ['red'],
    });
    await a.manejador(solicitud(PRIMERA));
    await a.manejador(solicitud(SEGUNDA));
    await a.manejador(solicitud(SEGUNDA));
    await a.manejador(solicitud({ ...PRIMERA, extra: 'nubankmarcador' }));
    await a.manejador(solicitud(PRIMERA, 'otro'));
    expect(a.lineas).toHaveLength(5);
    for (const linea of a.lineas) for (const p of PROHIBIDOS) expect(linea).not.toContain(p);
  });
});
