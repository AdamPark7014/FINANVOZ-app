import { describe, expect, it, vi } from 'vitest';
import { HERRAMIENTAS_EXPLICAR } from '../explicar/herramientas';
import type { PeticionTransporte, Transporte } from './cliente';
import { crearClienteTurno, type MensajeTurno } from './turno';

const respuesta = (status: number, cuerpo: unknown) => ({ status, json: async () => cuerpo });
const sobre = (salida: unknown) => ({
  salida,
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
const MENSAJES: MensajeTurno[] = [{ rol: 'usuario', texto: '¿en qué gasto más?' }];

describe('crearClienteTurno (POST /llm/turno)', () => {
  it('envía {mensajes, herramientas} con el JWT y valida la salida', async () => {
    const llamada = { id: 'toolu_1', nombre: 'mayores_gastos', argumentos: {} };
    const { transporte, llamadas } = transporteFalso(
      respuesta(200, sobre({ tipo: 'herramientas', llamadas: [llamada] })),
    );
    const c = crearClienteTurno({ url: 'https://abc.supabase.co/', obtenerToken: token, transporte });
    const r = await c.turno(MENSAJES, HERRAMIENTAS_EXPLICAR);
    expect(r).toEqual({
      tipo: 'ok',
      salida: { tipo: 'herramientas', llamadas: [llamada] },
      meta: {
        proveedor: 'anthropic',
        modelo: 'modelo-x',
        tokensEntrada: 900,
        tokensSalida: 60,
        latenciaMs: 850,
      },
    });
    const [p] = llamadas;
    expect(p?.url).toBe('https://abc.supabase.co/functions/v1/llm-turno');
    expect(p?.peticion.headers.Authorization).toBe('Bearer jwt');
    expect(JSON.parse(p?.peticion.body ?? '')).toEqual({
      mensajes: MENSAJES,
      herramientas: HERRAMIENTAS_EXPLICAR,
    });
  });

  it('403 solo_plus, 429 con su límite, 504 y 5xx', async () => {
    const casos = [
      [respuesta(403, { error: 'solo_plus' }), { tipo: 'solo_plus' }],
      [respuesta(429, { error: 'limite_mensual' }), { tipo: 'limite', codigo: 'limite_mensual' }],
      [respuesta(504, { error: 'tiempo_agotado' }), { tipo: 'error', codigo: 'tiempo_agotado', status: 504 }],
      [respuesta(502, { error: 'proveedor_fallo' }), { tipo: 'error', codigo: 'proveedor', status: 502 }],
      [respuesta(200, sobre({ tipo: 'otra' })), { tipo: 'error', codigo: 'respuesta_invalida', status: 200 }],
    ] as const;
    for (const [r, esperado] of casos) {
      const { transporte } = transporteFalso(r);
      const c = crearClienteTurno({ url: 'https://x', obtenerToken: token, transporte });
      expect(await c.turno(MENSAJES, HERRAMIENTAS_EXPLICAR)).toEqual(esperado);
    }
  });

  it('401 renueva el token una vez; sin red es sin_red; sin sesión, sin_sesion', async () => {
    const { transporte, llamadas } = transporteFalso(
      respuesta(401, {}),
      respuesta(200, sobre({ tipo: 'respuesta', texto: 'Listo.' })),
    );
    const c = crearClienteTurno({ url: 'https://x', obtenerToken: token, transporte });
    expect((await c.turno(MENSAJES, HERRAMIENTAS_EXPLICAR)).tipo).toBe('ok');
    expect(llamadas[1]?.peticion.headers.Authorization).toBe('Bearer jwt-nuevo');

    const sinRed = crearClienteTurno({
      url: 'https://x',
      obtenerToken: token,
      transporte: async () => {
        throw new TypeError('network');
      },
    });
    expect(await sinRed.turno(MENSAJES, HERRAMIENTAS_EXPLICAR)).toEqual({ tipo: 'sin_red' });
    const sinSesion = crearClienteTurno({ url: 'https://x', obtenerToken: async () => null });
    expect(await sinSesion.turno(MENSAJES, HERRAMIENTAS_EXPLICAR)).toEqual({
      tipo: 'error',
      codigo: 'sin_sesion',
    });
  });

  it('se rinde a los 8 s (tiempo_agotado)', async () => {
    const c = crearClienteTurno({
      url: 'https://x',
      obtenerToken: token,
      tiempoMaximoMs: 10,
      transporte: () => new Promise(() => undefined),
    });
    expect(await c.turno(MENSAJES, HERRAMIENTAS_EXPLICAR)).toEqual({
      tipo: 'error',
      codigo: 'tiempo_agotado',
    });
  });
});
