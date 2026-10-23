import { crearClienteNube, crearClienteTurno, HERRAMIENTAS_EXPLICAR } from '@cartera/nlu';
import { describe, expect, it, vi } from 'vitest';
import {
  CONTEXTO,
  en,
  fetchFalso,
  INTERPRETACION,
  json,
  respuestaAnthropic,
  respuestaOpenAI,
} from './__pruebas__/dobles.ts';
import { crearPresupuesto, interpretar, NO_ENTENDI } from './interpretar.ts';
import {
  type Adaptador,
  crearAnthropic,
  crearOpenAI,
  FallaProveedor,
  type NombreProveedor,
  PRESUPUESTO_TOTAL_MS,
  TIEMPO_INTENTO_INTERPRETAR_MS,
  TIEMPO_MAXIMO_MS,
  TIEMPO_MINIMO_INTENTO_MS,
} from './proveedores.ts';
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

describe('presupuesto total de la petición (P1: el teléfono no se rinde antes que el proxy)', () => {
  // Cada paso avanza el reloj inyectado `ms` (lo que "tardó" el proveedor) y responde o falla.
  type Paso = { ms: number; texto?: string; falla?: FallaProveedor };

  function armar(principal: Paso[], alterno: Paso[] | null = []) {
    const reloj = { t: 0 };
    const llamadas: NombreProveedor[] = [];
    const adaptador = (nombre: NombreProveedor, pasos: Paso[]): Adaptador => ({
      nombre,
      modelo: `${nombre}-x`,
      nulable: false,
      async llamar() {
        llamadas.push(nombre);
        const paso = pasos.shift();
        if (!paso) throw new Error('sin paso preparado');
        reloj.t += paso.ms;
        if (paso.falla) throw paso.falla;
        return { texto: paso.texto ?? '', tokens_entrada: 10, tokens_salida: 5 };
      },
    });
    const opciones = {
      adaptadores: alterno
        ? [adaptador('anthropic', principal), adaptador('openai', alterno)]
        : [adaptador('anthropic', principal)],
      validar: validarInterpretacion,
      ahora: () => reloj.t,
    };
    return { opciones, llamadas };
  }

  it('cada intento recibe min(tope, restante); el primero no lee el reloj; bajo el mínimo, ninguno', () => {
    let t = 0;
    const ahora = vi.fn(() => t);
    const plazo = crearPresupuesto(
      { ahora, tiempoMaximoMs: 4000, presupuestoMs: 7000, tiempoMinimoIntentoMs: 1500 },
      0,
    );
    expect(plazo()).toBe(4000);
    expect(ahora).not.toHaveBeenCalled();
    t = 2000;
    expect(plazo()).toBe(4000);
    t = 4000;
    expect(plazo()).toBe(3000);
    t = 5500;
    expect(plazo()).toBe(1500);
    t = 5501;
    expect(plazo()).toBeNull();
    expect(crearPresupuesto({ ahora: () => 0 }, 0)()).toBe(Math.min(TIEMPO_MAXIMO_MS, PRESUPUESTO_TOTAL_MS));
  });

  it('cada intento tiene un tope de ~4 s: una llamada colgada deja tiempo para otra, sin pasar del presupuesto', async () => {
    vi.useFakeTimers();
    try {
      const inicios: number[] = [];
      const colgado: Adaptador = {
        nombre: 'anthropic',
        modelo: 'anthropic-x',
        nulable: false,
        llamar: () => {
          inicios.push(Date.now());
          return new Promise<never>(() => undefined);
        },
      };
      const promesa = interpretar('x', CONTEXTO, {
        adaptadores: [colgado],
        validar: validarInterpretacion,
        ahora: () => Date.now(),
      });
      await vi.advanceTimersByTimeAsync(PRESUPUESTO_TOTAL_MS + 1000);
      const r = await promesa;
      expect(r).toMatchObject({ ok: false, codigo: 'tiempo_agotado', llamadas: 2 });
      expect(inicios).toHaveLength(2);
      expect((inicios[1] ?? 0) - (inicios[0] ?? 0)).toBe(TIEMPO_INTENTO_INTERPRETAR_MS);
      expect(r.latencia_ms).toBeLessThanOrEqual(PRESUPUESTO_TOTAL_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin alterno: tiempo agotado del principal → un reintento con el mismo proveedor, que responde', async () => {
    const { opciones, llamadas } = armar(
      [
        { ms: TIEMPO_INTENTO_INTERPRETAR_MS, falla: new FallaProveedor('tiempo') },
        { ms: 1200, texto: salida(INTERPRETACION) },
      ],
      null,
    );
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: true,
      proveedor: 'anthropic',
      interpretacion: INTERPRETACION,
      desenlace: 'ok',
      llamadas: 2,
      latencia_ms: TIEMPO_INTENTO_INTERPRETAR_MS + 1200,
    });
    expect(llamadas).toEqual(['anthropic', 'anthropic']);
  });

  it('sin alterno: un 5xx rápido también se reintenta una vez; un 4xx no', async () => {
    const cinco = armar(
      [
        { ms: 200, falla: new FallaProveedor('servidor', 529) },
        { ms: 800, texto: salida(INTERPRETACION) },
      ],
      null,
    );
    expect(await interpretar('x', CONTEXTO, cinco.opciones)).toMatchObject({ ok: true, llamadas: 2 });
    expect(cinco.llamadas).toEqual(['anthropic', 'anthropic']);

    const cuatro = armar([{ ms: 200, falla: new FallaProveedor('cliente', 400) }], null);
    expect(await interpretar('x', CONTEXTO, cuatro.opciones)).toMatchObject({
      ok: false,
      codigo: 'proveedor_fallo',
      llamadas: 1,
    });
    expect(cuatro.llamadas).toEqual(['anthropic']);
  });

  it('sin alterno: si el reintento tampoco responde, tiempo_agotado con dos llamadas (nunca tres)', async () => {
    const { opciones, llamadas } = armar(
      [
        { ms: TIEMPO_INTENTO_INTERPRETAR_MS, falla: new FallaProveedor('tiempo') },
        { ms: PRESUPUESTO_TOTAL_MS - TIEMPO_INTENTO_INTERPRETAR_MS, falla: new FallaProveedor('tiempo') },
      ],
      null,
    );
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: false,
      codigo: 'tiempo_agotado',
      llamadas: 2,
    });
    expect(llamadas).toEqual(['anthropic', 'anthropic']);
  });

  it('principal lento que agota el presupuesto → no se llama al alterno; tiempo_agotado (cupo devuelto)', async () => {
    const { opciones, llamadas } = armar(
      [{ ms: PRESUPUESTO_TOTAL_MS - TIEMPO_MINIMO_INTENTO_MS + 1, falla: new FallaProveedor('tiempo') }],
      [{ ms: 100, texto: salida(INTERPRETACION) }],
    );
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: false,
      codigo: 'tiempo_agotado',
      proveedor: 'anthropic',
      llamadas: 1,
    });
    expect(llamadas).toEqual(['anthropic']);
  });

  it('5xx rápido del principal → el alterno sí se llama porque queda tiempo', async () => {
    const { opciones, llamadas } = armar(
      [{ ms: 300, falla: new FallaProveedor('servidor', 503) }],
      [{ ms: 1200, texto: salida(INTERPRETACION) }],
    );
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: true,
      proveedor: 'openai',
      interpretacion: INTERPRETACION,
      latencia_ms: 1500,
      llamadas: 2,
    });
    expect(llamadas).toEqual(['anthropic', 'openai']);
  });

  it('respuesta inválida sin presupuesto para reparar → no hay reintento: aclarar/no_entendi', async () => {
    const { opciones, llamadas } = armar([
      { ms: 6000, texto: 'no es json' },
      { ms: 100, texto: salida(INTERPRETACION) },
    ]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: true,
      desenlace: 'no_entendi',
      interpretacion: NO_ENTENDI,
      llamadas: 1,
    });
    expect(llamadas).toEqual(['anthropic']);
  });

  it('respuesta inválida con presupuesto → sí se repara', async () => {
    const { opciones, llamadas } = armar([
      { ms: 2000, texto: 'no es json' },
      { ms: 1000, texto: salida(INTERPRETACION) },
    ]);
    expect(await interpretar('x', CONTEXTO, opciones)).toMatchObject({
      ok: true,
      desenlace: 'reintento_validacion',
      llamadas: 2,
    });
    expect(llamadas).toEqual(['anthropic', 'anthropic']);
  });

  it('coherencia: los clientes del teléfono esperan más que el presupuesto del proxy, con margen de red', async () => {
    const margenRedMs = 2000;
    vi.useFakeTimers();
    try {
      const senales: AbortSignal[] = [];
      const transporte = (_: string, p: { signal: AbortSignal }) => {
        senales.push(p.signal);
        return new Promise<never>(() => undefined);
      };
      const nube = crearClienteNube({ url: 'https://x', obtenerToken: async () => 'jwt', transporte });
      const turno = crearClienteTurno({ url: 'https://x', obtenerToken: async () => 'jwt', transporte });
      void nube.interpretar('x', CONTEXTO as never);
      void turno.turno([{ rol: 'usuario', texto: 'x' }], HERRAMIENTAS_EXPLICAR);
      await vi.advanceTimersByTimeAsync(PRESUPUESTO_TOTAL_MS + margenRedMs);
      expect(senales).toHaveLength(2);
      expect(senales.every((s) => !s.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
