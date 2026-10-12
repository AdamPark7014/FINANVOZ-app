import { describe, expect, it } from 'vitest';
import { cargarVectores } from '../__pruebas__/vectores';
import { ahorroPorDeducciones, isrPorTarifa, type FilaTarifa, type ResultadoAhorro } from './isr';

interface VectoresE13 {
  tarifa_prueba: FilaTarifa[];
  isr_por_tarifa: { base: number; esperado: number }[];
  ahorro: { id: string; base_gravable: number; deducciones: number; esperado: ResultadoAhorro }[];
}

const e13 = cargarVectores()['E13'] as VectoresE13;
const tarifa = e13.tarifa_prueba;

describe('E13.3 isrPorTarifa', () => {
  it('carga los vectores', () => expect(e13.isr_por_tarifa.length).toBe(5));

  for (const v of e13.isr_por_tarifa) {
    it(`E13.isr_por_tarifa base ${v.base} → ${v.esperado}`, () => {
      expect(isrPorTarifa(v.base, tarifa)).toBe(v.esperado);
    });
  }

  it('la última fila aplica sin límite superior', () => {
    expect(isrPorTarifa(60000000, tarifa)).toBe(4947200 + 3000000);
  });

  it('base negativa da 0', () => expect(isrPorTarifa(-500, tarifa)).toBe(0));

  it('rechaza tarifas mal formadas y bases no enteras', () => {
    const codigo = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return (e as { codigo?: string }).codigo;
      }
      return null;
    };
    expect(codigo(() => isrPorTarifa(100, []))).toBe('tarifa_invalida');
    expect(codigo(() => isrPorTarifa(100, [{ limite_inferior: 1, cuota_fija: 0, tasa_bp: 1 }]))).toBe(
      'tarifa_invalida',
    );
    expect(
      codigo(() =>
        isrPorTarifa(100, [
          { limite_inferior: 0, cuota_fija: 0, tasa_bp: 1 },
          { limite_inferior: 0, cuota_fija: 0, tasa_bp: 2 },
        ]),
      ),
    ).toBe('tarifa_invalida');
    expect(codigo(() => isrPorTarifa(100, [{ limite_inferior: 0, cuota_fija: -1, tasa_bp: 1 }]))).toBe(
      'tarifa_invalida',
    );
    expect(codigo(() => isrPorTarifa(100, [{ limite_inferior: 0, cuota_fija: 0, tasa_bp: 10001 }]))).toBe(
      'tarifa_invalida',
    );
    expect(codigo(() => isrPorTarifa(1.5, tarifa))).toBe('monto_invalido');
  });
});

describe('E13.3 ahorroPorDeducciones', () => {
  it('cubre todos los vectores E13.ahorro por id', () => {
    expect(e13.ahorro.map((v) => v.id).sort()).toEqual(['E13-20', 'E13-21', 'E13-22']);
  });

  for (const id of ['E13-20', 'E13-21', 'E13-22']) {
    it(`${id} reproduce el vector`, () => {
      const v = e13.ahorro.find((x) => x.id === id);
      if (!v) throw new Error(`falta el vector ${id}`);
      expect(ahorroPorDeducciones(v.base_gravable, v.deducciones, tarifa)).toEqual(v.esperado);
    });
  }

  it('sin deducciones no hay ahorro', () => {
    expect(ahorroPorDeducciones(30000000, 0, tarifa).ahorro_estimado).toBe(0);
  });

  it('rechaza deducciones negativas', () => {
    expect(() => ahorroPorDeducciones(100, -1, tarifa)).toThrow(
      expect.objectContaining({ codigo: 'monto_invalido' }),
    );
  });
});
