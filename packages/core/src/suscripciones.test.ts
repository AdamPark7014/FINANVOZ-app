import { describe, expect, it } from 'vitest';
import { cargarVectores } from './__pruebas__/vectores';
import {
  detectarSuscripciones,
  resumenActivas,
  type GastoSuscripcion,
  type Suscripcion,
} from './suscripciones';

interface VectorE14 {
  id: string;
  hoy: string;
  catalogo: string[];
  gastos: GastoSuscripcion[];
  esperado: Record<string, unknown>[];
  resumen_activas?: { cantidad: number; costo_anual: number; mensual: number };
}

const vectores = (cargarVectores()['E14'] as VectorE14[] | undefined) ?? [];
const porId = (id: string): VectorE14 => {
  const v = vectores.find((x) => x.id === id);
  if (!v) throw new Error(`falta el vector ${id}`);
  return v;
};

/** El vector no lleva la regla del compromiso; se compara aparte. */
function sinRegla(s: Suscripcion): Record<string, unknown> {
  const resto: Record<string, unknown> = { ...s };
  delete resto['regla'];
  return resto;
}

describe('E14 detección de suscripciones', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const id of ['E14-01', 'E14-02', 'E14-03']) {
    it(`${id} reproduce el vector`, () => {
      const v = porId(id);
      const r = detectarSuscripciones(v.gastos, v.hoy, v.catalogo);
      expect(r.map(sinRegla)).toEqual(v.esperado);
    });
  }

  it('E14-01 resumen de las activas', () => {
    const v = porId('E14-01');
    const r = detectarSuscripciones(v.gastos, v.hoy, v.catalogo);
    expect(resumenActivas(r)).toEqual(v.resumen_activas);
  });

  it('cubre todos los vectores E14 por id', () => {
    expect(vectores.map((v) => v.id).sort()).toEqual(['E14-01', 'E14-02', 'E14-03']);
  });

  it('regla del compromiso: mensual con el mayor día sin acotar, semanal con el día del último, anual con mes y día', () => {
    const v = porId('E14-01');
    const r = detectarSuscripciones(v.gastos, v.hoy, v.catalogo);
    const de = (c: string) => r.find((s) => s.comercio === c)?.regla;
    expect(de('NETFLIX')).toEqual({ tipo: 'mensual', dia: 14 });
    expect(de('ESTUDIO YOGA')).toEqual({ tipo: 'semanal', dia_semana: 5 });
    expect(de('DOMINIO WEB')).toEqual({ tipo: 'anual', mes: 10, dia: 8 });
  });

  it('un cargo del 31 queda dia 31 en la regla aunque proximo_cargo se acote', () => {
    const gastos = ['2026-08-31', '2026-09-30', '2026-10-31'].map((fecha) => ({
      fecha,
      monto: 9900,
      comercio: 'RENTA NUBE',
    }));
    const [s] = detectarSuscripciones(gastos, '2026-11-02', []);
    expect(s?.proximo_cargo).toBe('2026-11-30');
    expect(s?.regla).toEqual({ tipo: 'mensual', dia: 31 });
  });

  it('ignora gastos sin comercio, posteriores a hoy o fuera de la ventana de 400 días', () => {
    const gastos: GastoSuscripcion[] = [
      { fecha: '2026-08-01', monto: 100, comercio: null },
      { fecha: '2026-09-01', monto: 100, comercio: '' },
      { fecha: '2024-01-01', monto: 100, comercio: 'VIEJO' },
      { fecha: '2024-02-01', monto: 100, comercio: 'VIEJO' },
      { fecha: '2024-03-01', monto: 100, comercio: 'VIEJO' },
    ];
    expect(detectarSuscripciones(gastos, '2026-10-11', [])).toEqual([]);
  });

  it('no muta la entrada y es determinista', () => {
    const v = porId('E14-01');
    const copia = JSON.parse(JSON.stringify(v.gastos)) as GastoSuscripcion[];
    const a = detectarSuscripciones(v.gastos, v.hoy, v.catalogo);
    const b = detectarSuscripciones([...v.gastos].reverse(), v.hoy, v.catalogo);
    expect(v.gastos).toEqual(copia);
    expect(b).toEqual(a);
  });

  it('resumen vacío sin activas', () => {
    expect(resumenActivas([])).toEqual({ cantidad: 0, costo_anual: 0, mensual: 0 });
  });
});
