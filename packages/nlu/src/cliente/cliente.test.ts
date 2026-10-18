import { describe, expect, it, vi } from 'vitest';
import { cargarContexto, cargarGolden } from '../eval/fixtures';
import { Interpretacion } from '../esquema';
import {
  crearClienteNube,
  TIEMPO_MAXIMO_LLM_MS,
  TIEMPO_MAXIMO_MS,
  VERSION_ESQUEMA,
  type PeticionTransporte,
  type Transporte,
} from './cliente';
import { contextoMinimo } from './contexto-minimo';

const { contexto } = cargarContexto();
const golden = (id: string) => {
  const caso = cargarGolden().find((c) => c.id === id);
  if (!caso) throw new Error(id);
  return caso;
};

const respuesta = (status: number, cuerpo: unknown) => ({ status, json: async () => cuerpo });
const sobre = (interpretacion: unknown) => ({
  interpretacion,
  proveedor: 'anthropic',
  modelo: 'modelo-x',
  tokens_entrada: 900,
  tokens_salida: 60,
  latencia_ms: 850,
});

function transporteFalso(...respuestas: { status: number; json: () => Promise<unknown> }[]) {
  const llamadas: { url: string; peticion: PeticionTransporte }[] = [];
  const transporte: Transporte = async (url, peticion) => {
    llamadas.push({ url, peticion });
    const r = respuestas.shift();
    if (!r) throw new Error('sin respuesta preparada');
    return r;
  };
  return { transporte, llamadas };
}

const token = vi.fn(async (o?: { renovar?: boolean }) => (o?.renovar ? 'jwt-nuevo' : 'jwt'));

describe('crearClienteNube', () => {
  it('envía el contrato de 03 §6 y valida la Interpretacion con Zod (K06)', async () => {
    const k06 = golden('K06');
    const { transporte, llamadas } = transporteFalso(respuesta(200, sobre(k06.esperado)));
    const cliente = crearClienteNube({ url: 'https://abc.supabase.co/', obtenerToken: token, transporte });
    const r = await cliente.interpretar(k06.texto, contexto);
    expect(r).toEqual({
      tipo: 'ok',
      interpretacion: Interpretacion.parse(k06.esperado),
      meta: {
        proveedor: 'anthropic',
        modelo: 'modelo-x',
        tokensEntrada: 900,
        tokensSalida: 60,
        latenciaMs: 850,
      },
    });
    const [llamada] = llamadas;
    expect(llamada?.url).toBe('https://abc.supabase.co/functions/v1/nlu-interpretar');
    expect(llamada?.peticion.method).toBe('POST');
    expect(llamada?.peticion.headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(llamada?.peticion.body ?? '')).toEqual({
      texto: k06.texto,
      contexto_min: contexto,
      version_esquema: VERSION_ESQUEMA,
    });
  });

  it('una respuesta que no cumple el esquema es respuesta_invalida (el reintento es del proxy)', async () => {
    const malo = {
      intencion: 'registrar',
      movimientos: [{ tipo: 'gasto', monto: 80.5, fecha: '2026-10-11' }],
    };
    const { transporte } = transporteFalso(respuesta(200, sobre(malo)), respuesta(200, { otra: 1 }));
    const cliente = crearClienteNube({ url: 'https://x', obtenerToken: token, transporte });
    expect(await cliente.interpretar('x', contexto)).toEqual({
      tipo: 'error',
      codigo: 'respuesta_invalida',
      status: 200,
    });
    expect(await cliente.interpretar('x', contexto)).toMatchObject({ codigo: 'respuesta_invalida' });
  });

  it('mapea los errores del proxy: 429 por código, 400, 502, 504 y cuerpo ilegible', async () => {
    const { transporte } = transporteFalso(
      respuesta(429, { error: 'limite_mensual' }),
      respuesta(429, { error: 'tope_global' }),
      respuesta(400, { error: 'peticion_invalida' }),
      respuesta(502, { error: 'proveedor' }),
      respuesta(504, { error: 'tiempo_agotado' }),
      { status: 500, json: async () => Promise.reject(new SyntaxError('html')) },
      respuesta(418, {}),
    );
    const cliente = crearClienteNube({ url: 'https://x', obtenerToken: token, transporte });
    const r = () => cliente.interpretar('x', contexto);
    expect(await r()).toEqual({ tipo: 'limite', codigo: 'limite_mensual' });
    expect(await r()).toEqual({ tipo: 'limite', codigo: 'tope_global' });
    expect(await r()).toEqual({ tipo: 'error', codigo: 'peticion_invalida', status: 400 });
    expect(await r()).toEqual({ tipo: 'error', codigo: 'proveedor', status: 502 });
    expect(await r()).toEqual({ tipo: 'error', codigo: 'tiempo_agotado', status: 504 });
    expect(await r()).toEqual({ tipo: 'error', codigo: 'proveedor', status: 500 });
    expect(await r()).toEqual({ tipo: 'error', codigo: 'desconocido', status: 418 });
  });

  it('un 401 renueva el token una sola vez', async () => {
    const { transporte, llamadas } = transporteFalso(
      respuesta(401, { error: 'no_autorizado' }),
      respuesta(200, sobre(golden('C04').esperado)),
      respuesta(401, {}),
      respuesta(401, {}),
    );
    const cliente = crearClienteNube({ url: 'https://x', obtenerToken: token, transporte });
    expect((await cliente.interpretar('borra lo del cine', contexto)).tipo).toBe('ok');
    expect(llamadas.map((l) => l.peticion.headers.Authorization)).toEqual(['Bearer jwt', 'Bearer jwt-nuevo']);
    expect(await cliente.interpretar('x', contexto)).toEqual({
      tipo: 'error',
      codigo: 'no_autorizado',
      status: 401,
    });
    expect(llamadas).toHaveLength(4);
  });

  it('sin red, sin sesión y tiempo agotado (TIEMPO_MAXIMO_LLM_MS: 10 s)', async () => {
    expect(TIEMPO_MAXIMO_LLM_MS).toBe(10_000);
    expect(TIEMPO_MAXIMO_LLM_MS).toBeGreaterThan(TIEMPO_MAXIMO_MS);
    const sinRed = crearClienteNube({
      url: 'https://x',
      obtenerToken: token,
      transporte: async () => Promise.reject(new TypeError('Network request failed')),
    });
    expect(await sinRed.interpretar('x', contexto)).toEqual({ tipo: 'sin_red' });

    const sinSesion = crearClienteNube({ url: 'https://x', obtenerToken: async () => null });
    expect(await sinSesion.interpretar('x', contexto)).toEqual({ tipo: 'error', codigo: 'sin_sesion' });

    const tokenSinRed = crearClienteNube({
      url: 'https://x',
      obtenerToken: () => Promise.reject(new TypeError('Network request failed')),
    });
    expect(await tokenSinRed.interpretar('x', contexto)).toEqual({ tipo: 'sin_red' });

    vi.useFakeTimers();
    try {
      let senal: AbortSignal | null = null;
      const lento = crearClienteNube({
        url: 'https://x',
        obtenerToken: token,
        transporte: (_, p) => {
          senal = p.signal;
          return new Promise(() => {});
        },
      });
      const pendiente = lento.interpretar('x', contexto);
      await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_LLM_MS - 1);
      expect((senal as AbortSignal | null)?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pendiente).toEqual({ tipo: 'error', codigo: 'tiempo_agotado' });
      expect((senal as AbortSignal | null)?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('contextoMinimo (06 §4)', () => {
  it('no lleva ids, saldos, últimos 4 dígitos ni el nombre del negocio', () => {
    const c = contextoMinimo({
      hoy: '2026-10-11',
      espacios: ['personal'],
      cuentas: [
        {
          id: 'tarj_nu',
          tipo: 'credito',
          nombre: 'Nu ••4410',
          alias: ['Morada', 'nu'],
          saldo: -200_000,
          ultimos4: '4410',
        },
        { id: 'cta_ef', tipo: 'efectivo', nombre: 'Cartera', alias: [] },
        { id: 'cta_caja', tipo: 'efectivo', nombre: 'Caja', alias: ['tienda'], espacio: 'negocio' },
      ] as never,
      contactos: [['Jefa', 'mamá'], []],
      clientes: [['doña Mari']],
      ultimoIngreso: '2026-09-30',
      proximoIngreso: '2026-10-15',
      negocio: { nombre: 'Abarrotes Lupita' },
    } as never);
    expect(c).toEqual({
      fecha_referencia: '2026-10-11',
      dia_semana: 'domingo',
      espacios: ['personal'],
      cuentas: [
        { tipo: 'credito', alias: ['morada', 'nu'], espacio: 'personal' },
        { tipo: 'efectivo', alias: ['cartera'], espacio: 'personal' },
      ],
      contactos: [['jefa', 'mama']],
      ultimo_ingreso: '2026-09-30',
      proximo_ingreso: '2026-10-15',
    });
    const json = JSON.stringify(c);
    for (const prohibido of ['4410', 'tarj_nu', 'cta_', '200000', 'Lupita', 'saldo', 'id"']) {
      expect(json).not.toContain(prohibido);
    }
  });

  it('con negocio activo incluye sus cuentas y los clientes', () => {
    const c = contextoMinimo({
      hoy: '2026-10-12',
      espacios: ['personal', 'negocio'],
      cuentas: [{ tipo: 'efectivo', nombre: 'Caja', alias: ['tienda'], espacio: 'negocio' }],
      clientes: [['doña Mari', 'mari']],
    });
    expect(c.dia_semana).toBe('lunes');
    expect(c.cuentas).toEqual([{ tipo: 'efectivo', alias: ['tienda', 'caja'], espacio: 'negocio' }]);
    expect(c.clientes).toEqual([['dona mari', 'mari']]);
    expect(() => contextoMinimo({ hoy: '2026-02-30', cuentas: [] })).toThrow(TypeError);
  });
});
