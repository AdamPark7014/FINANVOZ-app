import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { aleatorioNode } from '../db/node';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { estadisticasActivas, fijarEstadisticas } from '../privacidad/estadisticas';
import { abrirPrueba } from '../servicios/__pruebas__/base';
import { camposCorreccionAnalitica } from '../servicios/correcciones';
import { crearAnalitica, type EnvioAnalitica } from './cliente';
import {
  EVENTOS_PERMITIDOS,
  PROPIEDADES_TECNICAS,
  bucketLatencia,
  validarEvento,
  type EventoAnalitica,
} from './eventos';

/** Datos de una persona que nunca pueden salir en un evento (RNF-05, regla 9; los mismos de CA-M2-06). */
const SENSIBLES = [
  '$1,234.56',
  '1234.56',
  '150000',
  '109990',
  '25 pesos',
  'OXXO',
  'WALMART',
  'Tacos El Güero',
  'la jefa',
  'mi compa Toño',
  'María López',
  'LOPM800101AB1',
  'me compré una coca de 25 en efectivo',
  'BBVA: Compra por $1,099.90 en WALMART con tarjeta *4321',
  '5512345678',
  'maria.lopez@gmail.com',
];

const BANCOS = new Set(['bbva', 'nu']);

function preparar({ consentimiento = true, estadisticas = false } = {}) {
  const p = abrirPrueba();
  if (consentimiento) aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas });
  const enviados: EnvioAnalitica[] = [];
  const analitica = crearAnalitica({
    transporte: (e) => {
      enviados.push(e);
      return Promise.resolve();
    },
    aleatorio: aleatorioNode,
    bancosPermitidos: BANCOS,
  });
  return { ...p, analitica, enviados };
}

/** Un evento válido de cada tipo permitido. */
const VALIDOS: EventoAnalitica[] = [
  { nombre: 'app_abierta', propiedades: {} },
  { nombre: 'onboarding_paso', propiedades: { paso: 3 } },
  {
    nombre: 'movimiento_registrado',
    propiedades: {
      origen: 'voz',
      nivel_interprete: 'reglas',
      pregunto: false,
      latencia_bucket: '<1s',
      espacio: 'personal',
    },
  },
  { nombre: 'correccion', propiedades: { campo: 'monto' } },
  { nombre: 'captura', propiedades: { banco_id: 'bbva', reconocida: true } },
  { nombre: 'arqueo', propiedades: { resultado: 'faltante' } },
  { nombre: 'simulacion_vista', propiedades: { escenarios: 4, recomendado_tipo: 'msi' } },
  { nombre: 'plan', propiedades: { evento: 'paywall_visto' } },
  { nombre: 'plantillas_remotas', propiedades: { version: 2, resultado: 'aceptada' } },
  { nombre: 'widget', propiedades: { evento: 'agregado' } },
  { nombre: 'modo_explicar', propiedades: { resultado: 'explicacion', vueltas: 2 } },
];

describe('analítica con opt-in (03 §8, RNF-05)', () => {
  it('apagada por omisión: sin consentimiento o sin aceptar estadísticas no sale nada', () => {
    for (const opciones of [{ consentimiento: false }, { consentimiento: true, estadisticas: false }]) {
      const p = preparar(opciones);
      expect(estadisticasActivas(p.ctx)).toBe(false);
      for (const e of VALIDOS) p.analitica.registrar(p.ctx, e);
      expect(p.enviados).toEqual([]);
      p.base.cerrar();
    }
  });

  it('con la casilla de O2 marcada envía solo las propiedades de la lista blanca', () => {
    const p = preparar({ estadisticas: true });
    for (const e of VALIDOS) p.analitica.registrar(p.ctx, e);
    expect(p.enviados.map((e) => e.evento)).toEqual(VALIDOS.map((e) => e.nombre));
    const [primero] = p.enviados;
    expect(primero).toEqual({
      evento: 'app_abierta',
      idAnonimo: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      instante: expect.stringMatching(/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      propiedades: { ...PROPIEDADES_TECNICAS },
    });
    // El mismo identificador anónimo en toda la instalación.
    expect(new Set(p.enviados.map((e) => e.idAnonimo)).size).toBe(1);
    expect(p.enviados[2]?.propiedades).toEqual({
      ...PROPIEDADES_TECNICAS,
      origen: 'voz',
      nivel_interprete: 'reglas',
      pregunto: false,
      latencia_bucket: '<1s',
      espacio: 'personal',
    });
    p.base.cerrar();
  });

  it('el interruptor del centro de privacidad la apaga, borra el identificador y al volver usa otro', () => {
    const p = preparar({ estadisticas: true });
    p.analitica.registrar(p.ctx, VALIDOS[0] as EventoAnalitica);
    fijarEstadisticas(p.ctx, false);
    expect(estadisticasActivas(p.ctx)).toBe(false);
    p.analitica.registrar(p.ctx, VALIDOS[0] as EventoAnalitica);
    expect(p.enviados).toHaveLength(1);
    fijarEstadisticas(p.ctx, true);
    p.analitica.registrar(p.ctx, VALIDOS[0] as EventoAnalitica);
    expect(p.enviados).toHaveLength(2);
    expect(p.enviados[1]?.idAnonimo).not.toBe(p.enviados[0]?.idAnonimo);
    p.base.cerrar();
  });

  it('descarta eventos fuera de la lista, propiedades de más y valores fuera de catálogo', () => {
    const p = preparar({ estadisticas: true });
    const malos: unknown[] = [
      { nombre: 'pantalla_vista', propiedades: { pantalla: 'hoy' } },
      { nombre: 'app_abierta', propiedades: { monto: 150000 } },
      { nombre: 'arqueo', propiedades: { resultado: 'faltante', hueco: 31500 } },
      { nombre: 'arqueo', propiedades: { resultado: 'Faltan $315' } },
      { nombre: 'movimiento_registrado', propiedades: { origen: 'voz', pregunto: false, espacio: 'OXXO' } },
      {
        nombre: 'movimiento_registrado',
        propiedades: { origen: 'voz', pregunto: false, espacio: 'personal', texto: 'coca de 25' },
      },
      { nombre: 'onboarding_paso', propiedades: { paso: 150000 } },
      { nombre: 'onboarding_paso', propiedades: { paso: 2.5 } },
      { nombre: 'captura', propiedades: { banco_id: 'oxxo', reconocida: true } },
      { nombre: 'captura', propiedades: { banco_id: 'bbva', reconocida: true, texto: 'Compra $25' } },
      { nombre: 'simulacion_vista', propiedades: { escenarios: 109990, recomendado_tipo: 'msi' } },
      { nombre: 'correccion', propiedades: { campo: 'la jefa' } },
      {
        nombre: 'plantillas_remotas',
        propiedades: { version: 2, resultado: 'aceptada', contenido: '{"bancos":[]}' },
      },
      { nombre: 'plantillas_remotas', propiedades: { version: 150000, resultado: 'aceptada' } },
      { nombre: 'plantillas_remotas', propiedades: { version: 2, resultado: 'BBVA: Compra por $1,099.90' } },
      { nombre: 'plantillas_remotas', propiedades: { version: 0, resultado: 'sin_red' } },
      { nombre: 'widget', propiedades: { evento: 'Hoy puedes $214' } },
      { nombre: 'widget', propiedades: { evento: 'agregado', cifra: '$214' } },
      { nombre: 'modo_explicar', propiedades: { resultado: 'explicacion', vueltas: 0 } },
      { nombre: 'modo_explicar', propiedades: { resultado: 'explicacion', vueltas: 5 } },
      {
        nombre: 'modo_explicar',
        propiedades: { resultado: 'plantilla', vueltas: 2, pregunta: '¿por qué no me alcanzó la quincena?' },
      },
      { nombre: 'modo_explicar', propiedades: { resultado: '$1,850 en plantilla', vueltas: 2 } },
      { nombre: 'app_abierta' },
      'app_abierta',
      null,
    ];
    for (const m of malos) p.analitica.registrar(p.ctx, m as EventoAnalitica);
    expect(p.enviados).toEqual([]);
    p.base.cerrar();
  });

  it('propiedad: con cualquier entrada, ninguna propiedad fuera de la lista ni dato de la persona sale', () => {
    const p = preparar({ estadisticas: true });
    const nombres = [...Object.keys(EVENTOS_PERMITIDOS), 'otro', 'texto'];
    const claves = [
      ...new Set(Object.values(EVENTOS_PERMITIDOS).flatMap((e) => Object.keys(e.shape))),
      'monto',
      'comercio',
      'alias',
      'texto',
      'nombre',
      'rfc',
    ];
    const valor = fc.oneof(
      fc.constantFrom(...SENSIBLES),
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.boolean(),
      fc.constantFrom(
        'voz',
        'texto',
        'personal',
        'faltante',
        'bbva',
        'msi',
        'reglas',
        '<1s',
        3,
        'aceptada',
        'sin_red',
        'agregado',
        'quitado',
        'explicacion',
        'plantilla',
      ),
    );
    const entradaAleatoria = fc.tuple(
      fc.constantFrom(...nombres),
      fc.dictionary(fc.constantFrom(...claves), valor),
    );
    /** Mezcla casos válidos de la lista blanca: evita corridas donde el fuzz solo descarta (flake ~1–2 % con 500 runs). */
    const entradaValida = fc.constantFrom(...VALIDOS.map((e) => [e.nombre, e.propiedades] as const));
    let enviosEnPropiedad = 0;
    fc.assert(
      fc.property(
        fc.oneof({ weight: 3, arbitrary: entradaValida }, { weight: 7, arbitrary: entradaAleatoria }),
        ([nombre, propiedades]) => {
          const antes = p.enviados.length;
          p.analitica.registrar(p.ctx, { nombre, propiedades } as unknown as EventoAnalitica);
          const nuevos = p.enviados.slice(antes);
          enviosEnPropiedad += nuevos.length;
          for (const enviado of nuevos) {
            const forma = EVENTOS_PERMITIDOS[enviado.evento as keyof typeof EVENTOS_PERMITIDOS];
            expect(forma).toBeDefined();
            const permitidas = new Set([...Object.keys(forma.shape), ...Object.keys(PROPIEDADES_TECNICAS)]);
            for (const k of Object.keys(enviado.propiedades)) expect(permitidas).toContain(k);
            // Solo payload del evento (no UUID ni instante: subcadenas hex pueden coincidir con dígitos de ejemplo).
            const json = JSON.stringify({
              evento: enviado.evento,
              propiedades: enviado.propiedades,
            }).toLowerCase();
            for (const s of SENSIBLES) expect(json).not.toContain(s.toLowerCase());
            // Ningún número con forma de monto: solo pasos y conteos chicos (la versión de plantillas, ≤ 999).
            for (const [k, v] of Object.entries(enviado.propiedades)) {
              if (typeof v === 'number') expect(Math.abs(v)).toBeLessThanOrEqual(k === 'version' ? 999 : 40);
              if (typeof v === 'string') expect(v).not.toMatch(/\d{3,}|\$/);
            }
          }
        },
      ),
      { numRuns: 500 },
    );
    expect(enviosEnPropiedad).toBeGreaterThan(0);
    p.base.cerrar();
  });

  it('un error del transporte no rompe la app ni deja rastro', async () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    const consola = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    const analitica = crearAnalitica({
      transporte: () => Promise.reject(new Error('sin red')),
      aleatorio: aleatorioNode,
      bancosPermitidos: BANCOS,
    });
    expect(() => analitica.registrar(p.ctx, { nombre: 'app_abierta', propiedades: {} })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    for (const spy of Object.values(consola)) expect(spy).not.toHaveBeenCalled();
    for (const spy of Object.values(consola)) spy.mockRestore();
    p.base.cerrar();
  });

  it('camposCorreccionAnalitica solo produce valores del enum correccion.campo', () => {
    const permitidos = new Set(['monto', 'categoria', 'cuenta', 'fecha', 'descripcion', 'tipo', 'otro']);
    for (const campo of camposCorreccionAnalitica({
      monto: 1,
      categoria: 'comida_fuera',
      origenId: 'x',
      fecha: '2026-10-11',
      descripcion: 'x',
    })) {
      expect(permitidos).toContain(campo);
    }
    expect(
      validarEvento(
        { nombre: 'correccion', propiedades: { campo: camposCorreccionAnalitica({ monto: 1 })[0] ?? '' } },
        BANCOS,
      ),
    ).toEqual({ nombre: 'correccion', propiedades: { campo: 'monto' } });
  });

  it('validarEvento y bucketLatencia', () => {
    expect(validarEvento({ nombre: 'arqueo', propiedades: { resultado: 'exacto' } }, BANCOS)).toEqual({
      nombre: 'arqueo',
      propiedades: { resultado: 'exacto' },
    });
    expect(
      validarEvento({ nombre: 'captura', propiedades: { banco_id: 'nu', reconocida: false } }, new Set()),
    ).toBeNull();
    expect([0, 999, 1000, 2999, 3000, 7999, 8000, 60_000].map(bucketLatencia)).toEqual([
      '<1s',
      '<1s',
      '1-3s',
      '1-3s',
      '3-8s',
      '3-8s',
      '>8s',
      '>8s',
    ]);
  });
});
