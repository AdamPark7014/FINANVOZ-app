import { describe, expect, it } from 'vitest';
import {
  CONTEXTO,
  en,
  fetchFalso,
  INTERPRETACION,
  json,
  respuestaAnthropic,
  respuestaOpenAI,
} from './__pruebas__/dobles.ts';
import { interpretar, NO_ENTENDI } from './interpretar.ts';
import { crearAnthropic, crearOpenAI } from './proveedores.ts';
import { validarInterpretacion } from './validar.ts';

const salida = (i: unknown) => JSON.stringify({ interpretacion: i });

function preparar(
  principal: Parameters<typeof fetchFalso>[0],
  alterno: Parameters<typeof fetchFalso>[0] = [],
) {
  const p = fetchFalso(principal);
  const a = fetchFalso(alterno);
  let reloj = 1000;
  const opciones = {
    adaptadores: [
      crearAnthropic({ llave: 'k', fetch: p.fetch }),
      crearOpenAI({ llave: 'k', fetch: a.fetch }),
    ],
    validar: validarInterpretacion,
    tiempoMaximoMs: 30,
    ahora: () => (reloj += 50),
  };
  return { opciones, principal: p, alterno: a };
}

describe('interpretar (06 §2, §10.1; 03 §6)', () => {
  it('respuesta válida del principal', async () => {
    const { opciones, alterno } = preparar([json(respuestaAnthropic(salida(INTERPRETACION)))]);
    const r = await interpretar('tacos', CONTEXTO, opciones);
    expect(r).toMatchObject({
      ok: true,
      interpretacion: INTERPRETACION,
      proveedor: 'anthropic',
      modelo: 'claude-haiku-5-5',
      tokens_entrada: 1200,
      tokens_salida: 80,
      latencia_ms: 50,
      desenlace: 'ok',
      llamadas: 1,
    });
    expect(alterno.peticiones).toHaveLength(0);
  });

  it('5xx del principal → un intento con el alterno, que quita los null de la variante nulable', async () => {
    const conNulos = {
      interpretacion: {
        intencion: 'registrar',
        movimientos: [{ ...INTERPRETACION.movimientos[0], destino: null, msi: null, aproximado: null }],
      },
    };
    const { opciones, principal, alterno } = preparar(
      [json({}, 529)],
      [json(respuestaOpenAI(JSON.stringify(conNulos)))],
    );
    const r = await interpretar('tacos', CONTEXTO, opciones);
    expect(r).toMatchObject({ ok: true, proveedor: 'openai', interpretacion: INTERPRETACION, llamadas: 2 });
    expect(principal.peticiones).toHaveLength(1);
    expect(alterno.peticiones).toHaveLength(1);
  });

  it('tiempo agotado (8 s en producción) → alterno; si también se agota → tiempo_agotado', async () => {
    const uno = preparar(['colgar'], [json(respuestaOpenAI(salida(INTERPRETACION)))]);
    expect(await interpretar('x', CONTEXTO, uno.opciones)).toMatchObject({ ok: true, proveedor: 'openai' });

    const dos = preparar(['colgar'], ['colgar']);
    expect(await interpretar('x', CONTEXTO, dos.opciones)).toMatchObject({
      ok: false,
      codigo: 'tiempo_agotado',
      llamadas: 2,
    });
  });

  it('los dos fallan con 5xx → proveedor_fallo con el estado del último', async () => {
    const { opciones } = preparar([json({}, 500)], [json({}, 502)]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: false,
      codigo: 'proveedor_fallo',
      proveedor: 'openai',
      estado_proveedor: 502,
    });
  });

  it('un 4xx no intenta el alterno', async () => {
    const { opciones, alterno } = preparar([json({}, 400)]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: false,
      codigo: 'proveedor_fallo',
    });
    expect(alterno.peticiones).toHaveLength(0);
  });

  it('validación fallida → un reintento con el error (sin valores) y tokens sumados', async () => {
    const invalida = {
      intencion: 'registrar',
      movimientos: [{ tipo: 'gasto', monto: 80.5, fecha: '2026-02-30' }],
    };
    const { opciones, principal } = preparar([
      json(respuestaAnthropic(salida(invalida))),
      json(respuestaAnthropic(salida(INTERPRETACION))),
    ]);
    const r = await interpretar('x', CONTEXTO, opciones);
    expect(r).toMatchObject({
      ok: true,
      desenlace: 'reintento_validacion',
      interpretacion: INTERPRETACION,
      tokens_entrada: 2400,
      tokens_salida: 160,
      llamadas: 2,
    });
    const mensajes = en(principal.peticiones, 1).cuerpo.messages as { role: string; content: string }[];
    expect(mensajes).toHaveLength(3);
    expect(mensajes[1]).toEqual({ role: 'assistant', content: salida(invalida) });
    expect(en(mensajes, 2).content).toContain('movimientos.0.monto');
    expect(en(mensajes, 2).content).toContain('movimientos.0.fecha');
    expect(en(mensajes, 2).content).not.toContain('80.5');
  });

  it('dos respuestas inválidas (o que no son JSON) → aclarar/no_entendi', async () => {
    const { opciones } = preparar([
      json(respuestaAnthropic('no es json')),
      json(respuestaAnthropic(salida({ intencion: 'inventada' }))),
    ]);
    const r = await interpretar('x', CONTEXTO, opciones);
    expect(r).toMatchObject({ ok: true, desenlace: 'no_entendi', interpretacion: NO_ENTENDI });
    expect(validarInterpretacion(NO_ENTENDI).ok).toBe(true);
  });

  it('falta la raíz { interpretacion } → cuenta como inválida', async () => {
    const { opciones } = preparar([
      json(respuestaAnthropic(JSON.stringify(INTERPRETACION))),
      json(respuestaAnthropic(salida(INTERPRETACION))),
    ]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({ desenlace: 'reintento_validacion' });
  });

  it('si el reintento por validación falla en red, responde no_entendi', async () => {
    const { opciones } = preparar([json(respuestaAnthropic('{}')), json({}, 500)]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({ ok: true, desenlace: 'no_entendi' });
  });
});
