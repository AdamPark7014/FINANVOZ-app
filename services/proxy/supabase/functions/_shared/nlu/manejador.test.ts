// CA-M3-04 · el proxy responde 401 sin JWT, 429 al rebasar límites y sus registros no contienen cuerpos.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTEXTO, en, fetchFalso, json, respuestaAnthropic } from './__pruebas__/dobles.ts';
import { interpretar } from './interpretar.ts';
import type { ResultadoCupo } from './limites.ts';
import { crearManejador, type DependenciasManejador } from './manejador.ts';
import { crearAnthropic, crearOpenAI } from './proveedores.ts';
import { type EventoRegistro, hashUsuario, lineaRegistro, registrarEnConsola } from './registro.ts';
import { validarInterpretacion } from './validar.ts';

const JWT_VALIDO = 'jwt.valido.firma';
const USUARIO = 'usuario-7f3e-anonimo';
// Marcadores que nunca deben aparecer en un registro: texto dictado, alias, contacto, monto (pesos y centavos).
const TEXTO = 'me eché unos tacosmarcador de 98765 con la nubankmarcador y le debo a juanmarcador';
const PROHIBIDOS = [
  'tacosmarcador',
  'nubankmarcador',
  'juanmarcador',
  '98765',
  'Bearer',
  JWT_VALIDO,
  USUARIO,
];

const contexto = {
  ...CONTEXTO,
  cuentas: [{ tipo: 'credito' as const, alias: ['nubankmarcador'] }],
  contactos: [['juanmarcador']],
};

const interpretacion = {
  intencion: 'registrar',
  movimientos: [
    {
      tipo: 'gasto',
      monto: 9876500,
      fecha: '2026-10-11',
      descripcion: 'tacosmarcador',
      categoria: 'comida_fuera',
      origen: { tipo: 'credito', alias: 'nubankmarcador' },
      contraparte: 'juanmarcador',
    },
  ],
};

function solicitud(cuerpo: unknown, jwt: string | null = JWT_VALIDO, metodo = 'POST') {
  const encabezados: Record<string, string> = { 'content-type': 'application/json' };
  if (jwt !== null) encabezados.authorization = `Bearer ${jwt}`;
  return new Request('https://proxy.prueba/functions/v1/nlu-interpretar', {
    method: metodo,
    headers: encabezados,
    ...(metodo === 'POST' ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}),
  });
}

const valido = { texto: TEXTO, contexto_min: contexto, version_esquema: 1 };

function armar(
  opciones: {
    cupo?: ResultadoCupo;
    principal?: Parameters<typeof fetchFalso>[0];
    alterno?: Parameters<typeof fetchFalso>[0];
  } = {},
) {
  const eventos: EventoRegistro[] = [];
  const lineas: string[] = [];
  const devueltos: string[] = [];
  const principal = fetchFalso(
    opciones.principal ?? [json(respuestaAnthropic(JSON.stringify({ interpretacion })))],
  );
  const alterno = fetchFalso(opciones.alterno ?? []);
  const deps: DependenciasManejador = {
    configurado: true,
    verificarUsuario: async (jwt) => (jwt === JWT_VALIDO ? USUARIO : null),
    consumirCupo: async () => opciones.cupo ?? 'ok',
    devolverCupo: async (id) => {
      devueltos.push(id);
    },
    interpretar: (texto, ctx) =>
      interpretar(texto, ctx, {
        adaptadores: [
          crearAnthropic({ llave: 'k', fetch: principal.fetch }),
          crearOpenAI({ llave: 'k', fetch: alterno.fetch }),
        ],
        validar: validarInterpretacion,
        tiempoMaximoMs: 30,
        ahora: () => 0,
      }),
    hashUsuario: (id) => hashUsuario(id, 'sal-de-prueba'),
    registrar: (e) => {
      eventos.push(e);
      lineas.push(lineaRegistro(e));
    },
  };
  return { manejador: crearManejador(deps), eventos, lineas, devueltos };
}

async function cuerpo(r: Response) {
  return (await r.json()) as Record<string, unknown>;
}

describe('CA-M3-04 · autenticación', () => {
  it('401 sin JWT', async () => {
    const { manejador, eventos } = armar();
    const r = await manejador(solicitud(valido, null));
    expect(r.status).toBe(401);
    expect(await cuerpo(r)).toEqual({ error: 'no_autorizado' });
    expect(eventos[0]).toMatchObject({ codigo: 'no_autorizado', estado_http: 401, usuario_hash: null });
  });

  it('401 con JWT inválido o encabezado mal formado', async () => {
    const { manejador } = armar();
    expect((await manejador(solicitud(valido, 'otro'))).status).toBe(401);
    const sinBearer = new Request('https://p/x', {
      method: 'POST',
      headers: { authorization: JWT_VALIDO },
      body: '{}',
    });
    expect((await manejador(sinBearer)).status).toBe(401);
  });

  it('401 antes de validar el cuerpo', async () => {
    const { manejador } = armar();
    expect((await manejador(solicitud('no json', null))).status).toBe(401);
  });
});

describe('CA-M3-04 · límites', () => {
  for (const codigo of ['limite_diario', 'limite_mensual', 'tope_global'] as const) {
    it(`429 ${codigo} sin llamar al proveedor`, async () => {
      const { manejador, eventos } = armar({ cupo: codigo, principal: [] });
      const r = await manejador(solicitud(valido));
      expect(r.status).toBe(429);
      expect(await cuerpo(r)).toEqual({ error: codigo });
      expect(eventos[0]).toMatchObject({ codigo, estado_http: 429 });
    });
  }
});

describe('contrato de /nlu/interpretar (03 §6)', () => {
  it('200 con { interpretacion, proveedor, modelo, tokens_entrada, tokens_salida, latencia_ms }', async () => {
    const { manejador } = armar();
    const r = await manejador(solicitud(valido));
    expect(r.status).toBe(200);
    expect(await cuerpo(r)).toEqual({
      interpretacion,
      proveedor: 'anthropic',
      modelo: 'claude-haiku-5-5',
      tokens_entrada: 1200,
      tokens_salida: 80,
      latencia_ms: 0,
    });
  });

  it.each([
    ['no es JSON', 'no json'],
    ['sin texto', { contexto_min: contexto, version_esquema: 1 }],
    ['texto vacío', { ...valido, texto: '  ' }],
    ['texto demasiado largo', { ...valido, texto: 'a'.repeat(501) }],
    ['sin version_esquema', { texto: TEXTO, contexto_min: contexto }],
    ['clave extra', { ...valido, saldo: 1 }],
    ['contexto con saldos', { ...valido, contexto_min: { ...contexto, saldos: [100] } }],
    [
      'cuenta con id',
      { ...valido, contexto_min: { ...contexto, cuentas: [{ tipo: 'debito', alias: [], id: 'x' }] } },
    ],
    ['fecha inválida', { ...valido, contexto_min: { ...contexto, fecha_referencia: '11/10/2026' } }],
    [
      'cuerpo enorme',
      {
        ...valido,
        contexto_min: {
          ...contexto,
          contactos: Array(40)
            .fill(['x'.repeat(60)])
            .map((a) => Array(10).fill(a[0])),
        },
      },
    ],
  ])('400 solicitud_invalida: %s', async (_, c) => {
    const { manejador } = armar({ principal: [] });
    const r = await manejador(solicitud(c));
    expect(r.status).toBe(400);
    expect(await cuerpo(r)).toEqual({ error: 'solicitud_invalida' });
  });

  it('405 con otro método', async () => {
    const { manejador } = armar();
    expect((await manejador(solicitud(null, JWT_VALIDO, 'GET'))).status).toBe(405);
  });

  it('502 proveedor_fallo tras el alterno y 504 tiempo_agotado; el cupo se devuelve', async () => {
    const a = armar({ principal: [json({}, 500)], alterno: [json({}, 503)] });
    const r = await a.manejador(solicitud(valido));
    expect(r.status).toBe(502);
    expect(await cuerpo(r)).toEqual({ error: 'proveedor_fallo' });
    expect(a.devueltos).toEqual([USUARIO]);
    expect(a.eventos[0]).toMatchObject({ codigo: 'proveedor_fallo', estado_proveedor: 503, llamadas: 2 });

    const b = armar({ principal: ['colgar'], alterno: ['colgar'] });
    const r2 = await b.manejador(solicitud(valido));
    expect(r2.status).toBe(504);
    expect(await cuerpo(r2)).toEqual({ error: 'tiempo_agotado' });
    expect(b.devueltos).toEqual([USUARIO]);
  });

  it('503 sin_configurar si faltan secretos', async () => {
    const eventos: EventoRegistro[] = [];
    const m = crearManejador({
      configurado: false,
      verificarUsuario: async () => USUARIO,
      consumirCupo: async () => 'ok',
      devolverCupo: async () => undefined,
      interpretar: async () => {
        throw new Error('no debe llamarse');
      },
      hashUsuario: async () => 'h',
      registrar: (e) => eventos.push(e),
    });
    const r = await m(solicitud(valido));
    expect(r.status).toBe(503);
    expect(await cuerpo(r)).toEqual({ error: 'sin_configurar' });
  });

  it('500 error_interno si algo inesperado falla, sin registrar el mensaje del error', async () => {
    const lineas: string[] = [];
    const m = crearManejador({
      configurado: true,
      verificarUsuario: async () => USUARIO,
      consumirCupo: async () => {
        throw new Error(`fallo con ${TEXTO}`);
      },
      devolverCupo: async () => undefined,
      interpretar: async () => {
        throw new Error('no');
      },
      hashUsuario: (id) => hashUsuario(id, 's'),
      registrar: (e) => lineas.push(lineaRegistro(e)),
    });
    const r = await m(solicitud(valido));
    expect(r.status).toBe(500);
    expect(lineas.join('\n')).not.toContain('tacosmarcador');
  });
});

describe('CA-M3-04 · registros solo con metadatos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ningún registro contiene texto, alias, contactos, montos, JWT ni el id del usuario', async () => {
    const escenarios = [
      armar(),
      armar({ cupo: 'limite_diario' }),
      armar({ principal: [json({}, 500)], alterno: [json({}, 503)] }),
      armar({
        principal: [
          json(respuestaAnthropic(JSON.stringify({ interpretacion: { ...interpretacion, extra: TEXTO } }))),
          json(respuestaAnthropic('no json 98765')),
        ],
      }),
    ];
    for (const e of escenarios) {
      await e.manejador(solicitud(valido));
      await e.manejador(solicitud(valido, null));
      await e.manejador(solicitud({ ...valido, saldo: 98765 }));
    }
    const todas = escenarios.flatMap((e) => e.lineas);
    expect(todas.length).toBeGreaterThanOrEqual(12);
    const texto = todas.join('\n');
    for (const prohibido of PROHIBIDOS) expect(texto).not.toContain(prohibido);
    for (const linea of todas) {
      const claves = Object.keys(JSON.parse(linea) as object);
      expect(
        claves.every((c) =>
          [
            'usuario_hash',
            'endpoint',
            'codigo',
            'estado_http',
            'proveedor',
            'modelo',
            'tokens_entrada',
            'tokens_salida',
            'latencia_ms',
            'llamadas',
            'estado_proveedor',
          ].includes(c),
        ),
      ).toBe(true);
    }
    // El hash del usuario sí está (para contar uso), pero no el id.
    expect(texto).toContain(await hashUsuario(USUARIO, 'sal-de-prueba'));
  });

  it('lineaRegistro descarta campos no permitidos y textos que no son identificadores', () => {
    const evento = {
      usuario_hash: 'abc123',
      endpoint: '/nlu/interpretar',
      codigo: 'ok',
      estado_http: 200,
      modelo: TEXTO,
      texto: TEXTO,
      interpretacion: { monto: 98765 },
    } as unknown as EventoRegistro;
    expect(JSON.parse(lineaRegistro(evento))).toEqual({
      usuario_hash: 'abc123',
      endpoint: '/nlu/interpretar',
      codigo: 'ok',
      estado_http: 200,
    });
  });

  it('registrarEnConsola escribe una sola línea JSON', () => {
    const espia = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    registrarEnConsola({
      usuario_hash: null,
      endpoint: '/nlu/interpretar',
      codigo: 'no_autorizado',
      estado_http: 401,
    });
    expect(espia).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(en(espia.mock.calls, 0)[0]))).toMatchObject({ codigo: 'no_autorizado' });
  });
});
