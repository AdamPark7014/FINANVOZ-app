import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extraerCifras, validarCifras } from '@cartera/nlu';
import { listarCuentas } from './cuentas';
import type { EventoAnalitica } from '../analitica/eventos';
import {
  AVISO_SIN_EXPLICACION,
  explicar,
  LLAMADAS_MAXIMAS_EXPLICAR,
  MENSAJE_LIMITE_EXPLICAR_DIARIO,
  MENSAJE_LIMITE_EXPLICAR_MENSUAL_GRATIS,
  MENSAJE_LIMITE_EXPLICAR_MENSUAL_PLUS,
  MENSAJE_LIMITE_EXPLICAR_TOPE,
  mensajeLimiteExplicar,
} from './explicar';
import { registrarMovimiento } from './formulario';
import { listarMovimientos } from './movimientos';
import type { NivelNube } from './nube';
import { sincronizarPlan } from './plan';
import { registrarTexto } from './registrar';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, golden } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';
import { pide, responde, turnoGuionado, type PasoGuion } from './__pruebas__/turno';

/**
 * Semilla `e4-01` (hoy dom 11 oct) con Plus y cuatro gastos con la Nu: tacos $450 el 3 sep; restaurante $1,200
 * el 2 oct, súper $1,100 el 5 oct y uber $350 el 8 oct.
 */
function semilla({ plus = true }: { plus?: boolean } = {}) {
  const p = abrirPrueba();
  cargarEscenario(p.ctx, escenario('e4-01'));
  if (plus) sincronizarPlan(p.ctx, { plus: { vigenteHasta: null, enPrueba: false, renovara: true } });
  const cuentas = listarCuentas(p.ctx);
  const nu = [...cuentas.tienes, ...cuentas.debes].find((c) => c.nombre.startsWith('Nu'))?.id as string;
  const gasto = (monto: number, fecha: string, categoria: string, descripcion: string) =>
    registrarMovimiento(p.ctx, { tipo: 'gasto', monto, fecha, categoria, origenId: nu, descripcion });
  gasto(45_000, '2026-09-03', 'comida_fuera', 'tacos');
  gasto(120_000, '2026-10-02', 'comida_fuera', 'restaurante');
  gasto(110_000, '2026-10-05', 'super', 'super');
  gasto(35_000, '2026-10-08', 'transporte', 'uber');
  return { ...p, movimientos: listarMovimientos(p.ctx).length };
}

function conTurnos(guion: PasoGuion[]) {
  const f = nubeFalsa();
  const t = turnoGuionado(guion);
  const nube: NivelNube = { ...f.nube, turno: t.cliente };
  return { ...t, nube, red: f };
}

/** Verificación automática de CA-M10-06: cada cifra del texto está en algún resultado que recibió el modelo. */
function cifrasDeResultados(texto: string, resultados: readonly string[]) {
  const permitidas = new Set(resultados.flatMap(extraerCifras));
  return extraerCifras(texto).filter((c) => !permitidas.has(c));
}

const PREGUNTAS: { pregunta: string; guion: PasoGuion[]; texto: string }[] = [
  {
    pregunta: golden('Q13').texto,
    guion: [
      pide(['comparar_periodos', { categoria: 'comida' }], ['mayores_gastos']),
      responde(
        'Gastaste $1,850 más en comida que a estas alturas del mes pasado: $2,300 contra $450. Lo que más pesa es comida fuera, con $1,200.',
      ),
    ],
    texto: '',
  },
  {
    pregunta: '¿en qué se me va el dinero?',
    guion: [
      pide(['mayores_gastos']),
      responde(
        'En los últimos 30 días lo que más pesa es comida fuera ($1,200), luego el súper ($1,100) y el transporte ($350).',
      ),
    ],
    texto: '',
  },
  {
    pregunta: '¿por qué hoy no puedo gastar nada?',
    guion: [
      pide(['hoy'], ['compromisos']),
      responde(
        'Hoy tienes $0 porque te faltan $2,244 para cubrir lo que viene antes de tu quincena: en los próximos 30 días tienes 3 pagos por $5,674, entre ellos la renta de $4,500.',
      ),
    ],
    texto: '',
  },
  {
    pregunta: '¿por qué debo tanto en la tarjeta?',
    guion: [
      pide(['tarjetas']),
      pide(['gasto', { desde: '2026-09-30', hasta: '2026-10-11', categoria: 'comida' }]),
      responde(
        'Debes $5,100 en tu Nu. Desde tu quincena del 30 sep llevas $2,300 en comida (2 movimientos).',
      ),
    ],
    texto: '',
  },
  {
    pregunta: '¿me alcanza lo del banco para la renta?',
    guion: [
      pide(['saldos', { alias: 'bbva' }], ['compromisos']),
      responde('En BBVA Débito tienes $3,590 y la renta del sáb 31 oct es de $4,500.'),
    ],
    texto: '',
  },
];
for (const q of PREGUNTAS) {
  const ultimo = q.guion[q.guion.length - 1];
  q.texto = ultimo && 'texto' in ultimo ? ultimo.texto : '';
}

let consola: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  consola = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});
afterEach(() => {
  // Regla 9: el modo explicar no escribe nada en la consola (ni pregunta, ni resultados, ni respuesta).
  for (const s of consola) expect(s).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('CA-M10-06 · cinco preguntas guionadas sobre la semilla', () => {
  for (const q of PREGUNTAS) {
    it(`«${q.pregunta}»: toda cifra de la respuesta aparece en un resultado de herramienta`, async () => {
      const p = semilla();
      const t = conTurnos([...q.guion]);
      const r = await explicar(p.ctx, q.pregunta, { nube: t.nube });
      expect(r).toMatchObject({ tipo: 'explicacion', texto: q.texto });
      // Verificación automática independiente de la del servicio, y que la respuesta sí tiene cifras.
      expect(extraerCifras(q.texto).length).toBeGreaterThanOrEqual(2);
      expect(cifrasDeResultados(q.texto, t.resultados())).toEqual([]);
      expect(validarCifras(q.texto, t.resultados()).ok).toBe(true);
      // El modelo recibió solo resultados agregados: sin ids de cuentas ni filtros.
      for (const res of t.resultados()) expect(res).not.toMatch(/id-\d+|cuentaId|filtro/);
      // Nada se escribió en el libro.
      expect(listarMovimientos(p.ctx)).toHaveLength(p.movimientos);
    });
  }

  it('una cifra inventada a propósito cae en la respuesta de plantilla', async () => {
    const p = semilla();
    const t = conTurnos([
      pide(['comparar_periodos', { categoria: 'comida' }], ['mayores_gastos']),
      responde('Gastaste $1,900 más en comida que el mes pasado.'),
    ]);
    const r = await explicar(p.ctx, golden('Q13').texto, { nube: t.nube });
    expect(cifrasDeResultados('Gastaste $1,900 más en comida que el mes pasado.', t.resultados())).toEqual([
      '1900',
    ]);
    if (r.tipo !== 'plantilla') throw new Error(r.tipo);
    expect(r.aviso).toBe(AVISO_SIN_EXPLICACION);
    expect(r.respuestas.map((x) => x.texto)).toEqual([
      'Vas $1,850 arriba en comida que a estas alturas del mes pasado.',
      'En los últimos 30 días, lo que más pesa es comida fuera: $1,200.',
    ]);
    expect(r.filtro).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-11',
      soloGastos: true,
      categorias: ['comida_fuera', 'antojos', 'super'],
    });
  });

  it('una suma que hizo el modelo ($2,300 + $450) también cae en la plantilla', async () => {
    const p = semilla();
    const t = conTurnos([
      pide(['comparar_periodos', { categoria: 'comida' }]),
      responde('Entre los dos meses llevas $2,750 en comida.'),
    ]);
    expect((await explicar(p.ctx, '¿cuánto llevo en comida?', { nube: t.nube })).tipo).toBe('plantilla');
  });
});

describe('Q13 del golden set (06 §6)', () => {
  it('la consulta explicar que devuelve la nube se enruta al modo explicar con la pregunta', async () => {
    const p = semilla();
    const f = nubeFalsa({ [golden('Q13').texto]: golden('Q13').esperado });
    const r = await registrarTexto(p.ctx, golden('Q13').texto, 'voz', { nube: f.nube });
    expect(r).toEqual({ resultado: 'explicar', pregunta: 'por qué no me alcanzó la quincena pasada' });
    expect(listarMovimientos(p.ctx)).toHaveLength(p.movimientos);
  });
});

describe('analítica modo_explicar (03 §8, pendiente 87)', () => {
  it('emite resultado y vueltas al terminar; no en solo_plus, sin_red, límite ni error', async () => {
    const p = semilla();
    const eventos: EventoAnalitica[] = [];
    const registrarEvento = (e: EventoAnalitica) => eventos.push(e);

    const ok = conTurnos([pide(['mayores_gastos']), responde('En 30 días lo que más pesa es comida fuera ($1,200).')]);
    await explicar(p.ctx, '¿en qué se me va el dinero?', { nube: ok.nube, registrarEvento });
    expect(eventos).toEqual([{ nombre: 'modo_explicar', propiedades: { resultado: 'explicacion', vueltas: 2 } }]);

    eventos.length = 0;
    const plant = conTurnos([
      pide(['comparar_periodos', { categoria: 'comida' }], ['mayores_gastos']),
      responde('Gastaste $1,900 más en comida que el mes pasado.'),
    ]);
    await explicar(p.ctx, golden('Q13').texto, { nube: plant.nube, registrarEvento });
    expect(eventos).toEqual([{ nombre: 'modo_explicar', propiedades: { resultado: 'plantilla', vueltas: 2 } }]);

    eventos.length = 0;
    await explicar(p.ctx, '¿?', { nube: conTurnos([{ tipo: 'solo_plus' }]).nube, registrarEvento });
    await explicar(p.ctx, '¿?', { nube: conTurnos([{ tipo: 'sin_red' }]).nube, registrarEvento });
    await explicar(p.ctx, '¿?', {
      nube: conTurnos([{ tipo: 'limite', codigo: 'limite_mensual' }]).nube,
      registrarEvento,
    });
    expect(
      await explicar(p.ctx, '¿?', { nube: conTurnos([{ tipo: 'error', codigo: 'proveedor', status: 502 }]).nube, registrarEvento }),
    ).toEqual({ tipo: 'error' });
    expect(eventos).toEqual([]);
  });
});

describe('modo explicar: límites y fallas', () => {
  it('Gratis: solo_plus sin preguntar nada a la nube', async () => {
    const p = semilla({ plus: false });
    const t = conTurnos([]);
    expect(await explicar(p.ctx, '¿en qué gasto más?', { nube: t.nube })).toEqual({ tipo: 'solo_plus' });
    expect(t.vueltas).toHaveLength(0);
  });

  it('sin nube, sin cliente de turnos o sin red: sin_red', async () => {
    const p = semilla();
    expect(await explicar(p.ctx, '¿en qué gasto más?')).toEqual({ tipo: 'sin_red' });
    const sinTurno = nubeFalsa();
    expect(await explicar(p.ctx, '¿en qué gasto más?', { nube: sinTurno.nube })).toEqual({ tipo: 'sin_red' });
    const t = conTurnos([]);
    t.red.desconectar();
    expect(await explicar(p.ctx, '¿en qué gasto más?', { nube: t.nube })).toEqual({ tipo: 'sin_red' });
  });

  it(`a lo más ${LLAMADAS_MAXIMAS_EXPLICAR} llamadas: si pide más en una vuelta, se ejecutan las que caben`, async () => {
    const p = semilla();
    const t = conTurnos([
      pide(['hoy'], ['tarjetas'], ['mayores_gastos'], ['compromisos']),
      responde('Debes $5,100 en total.'),
    ]);
    const r = await explicar(p.ctx, '¿cómo voy?', { nube: t.nube });
    expect(r.tipo).toBe('explicacion');
    const segunda = t.vueltas[1]?.mensajes ?? [];
    expect(segunda.filter((m) => m.rol === 'herramienta').map((m) => m.nombre)).toEqual([
      'hoy',
      'tarjetas',
      'mayores_gastos',
    ]);
    const asistente = segunda.find((m) => m.rol === 'asistente');
    expect(asistente && 'llamadas' in asistente ? asistente.llamadas : []).toHaveLength(3);
  });

  it('si el modelo nunca responde, después de 3 llamadas muestra la plantilla de lo consultado', async () => {
    const p = semilla();
    const t = conTurnos([pide(['tarjetas']), pide(['tarjetas']), pide(['tarjetas']), pide(['tarjetas'])]);
    const r = await explicar(p.ctx, '¿cuánto debo?', { nube: t.nube });
    if (r.tipo !== 'plantilla') throw new Error(r.tipo);
    expect(r.respuestas.map((x) => x.texto)).toEqual(Array(3).fill('Debes $5,100 en total.'));
    expect(t.vueltas).toHaveLength(4);
  });

  it('argumentos inválidos: no ejecuta y le responde al modelo con un error', async () => {
    const p = semilla();
    const t = conTurnos([
      pide(['gasto', { desde: '2026-02-30' }]),
      responde('No tengo datos de esas fechas.'),
    ]);
    const r = await explicar(p.ctx, '¿cuánto gasté el 30 de febrero?', { nube: t.nube });
    expect(r).toMatchObject({ tipo: 'explicacion', texto: 'No tengo datos de esas fechas.', filtro: {}, vueltas: 2 });
    expect(t.resultados()).toEqual(['{"error":"argumentos_invalidos"}']);
  });

  it('una herramienta que no existe no se ejecuta ni se reenvía; sin consultas, plantilla por omisión', async () => {
    const p = semilla();
    const t = conTurnos([pide(['borrar_todo'])]);
    const r = await explicar(p.ctx, '¿por qué no me alcanzó?', { nube: t.nube });
    if (r.tipo !== 'plantilla') throw new Error(r.tipo);
    expect(r.respuestas.map((x) => x.plantilla)).toEqual(['comparar_periodos', 'mayores_gastos']);
    expect(t.vueltas).toHaveLength(1);
  });

  it('el proxy dice solo_plus: lo respeta', async () => {
    const p = semilla();
    expect(await explicar(p.ctx, '¿?', { nube: conTurnos([{ tipo: 'solo_plus' }]).nube })).toEqual({
      tipo: 'solo_plus',
    });
  });

  it.each([
    ['limite_mensual', true, MENSAJE_LIMITE_EXPLICAR_MENSUAL_PLUS],
    ['limite_mensual', false, MENSAJE_LIMITE_EXPLICAR_MENSUAL_GRATIS],
    ['limite_diario', true, MENSAJE_LIMITE_EXPLICAR_DIARIO],
    ['limite_diario', false, MENSAJE_LIMITE_EXPLICAR_DIARIO],
    ['tope_global', true, MENSAJE_LIMITE_EXPLICAR_TOPE],
    ['tope_global', false, MENSAJE_LIMITE_EXPLICAR_TOPE],
  ] as const)('proxy devuelve límite %s (plus=%s): tipo y mensaje', async (codigo, plus, mensaje) => {
    const p = semilla({ plus });
    expect(await explicar(p.ctx, '¿?', { nube: conTurnos([{ tipo: 'limite', codigo }]).nube })).toEqual({
      tipo: 'limite',
      codigo,
      mensaje,
    });
  });

  it('cupo agotado: mensaje en tuteo es-MX para explicar, sin Por revisar', () => {
    for (const plan of ['gratis', 'plus'] as const) {
      const m = mensajeLimiteExplicar('limite_mensual', plan);
      expect(m).toMatch(/Pregúntame|responderte|tus /i);
      expect(m).not.toMatch(/Por revisar|La guardé/i);
      expect(m).toBe(
        plan === 'plus' ? MENSAJE_LIMITE_EXPLICAR_MENSUAL_PLUS : MENSAJE_LIMITE_EXPLICAR_MENSUAL_GRATIS,
      );
    }
    const diario = mensajeLimiteExplicar('limite_diario', 'plus');
    expect(diario).toContain('Pregúntame de nuevo mañana');
    expect(diario).not.toMatch(/Por revisar/i);
    expect(mensajeLimiteExplicar('tope_global', 'gratis')).toBe(MENSAJE_LIMITE_EXPLICAR_TOPE);
    expect(mensajeLimiteExplicar('tope_global', 'plus')).toBe(MENSAJE_LIMITE_EXPLICAR_TOPE);
  });

  it('falla a media pregunta: muestra en plantilla lo ya consultado; al inicio, error', async () => {
    const p = semilla();
    const media = conTurnos([pide(['tarjetas']), { tipo: 'error', codigo: 'proveedor', status: 502 }]);
    const r = await explicar(p.ctx, '¿cuánto debo?', { nube: media.nube });
    expect(r).toMatchObject({ tipo: 'plantilla', respuestas: [{ texto: 'Debes $5,100 en total.' }] });
    const inicio = conTurnos([{ tipo: 'error', codigo: 'proveedor', status: 502 }]);
    expect(await explicar(p.ctx, '¿cuánto debo?', { nube: inicio.nube })).toEqual({ tipo: 'error' });
    const sinRed = conTurnos([{ tipo: 'sin_red' }]);
    expect(await explicar(p.ctx, '¿cuánto debo?', { nube: sinRed.nube })).toEqual({ tipo: 'sin_red' });
  });
});
