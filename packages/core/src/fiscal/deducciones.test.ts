import { describe, expect, it } from 'vitest';
import { cargarVectores } from '../__pruebas__/vectores';
import {
  estimarDeducciones,
  type CfdiLeido,
  type CfdiParaDeducir,
  type ConfigDeducciones,
  type EtiquetaCfdi,
  type ResultadoDeducciones,
} from './deducciones';

interface VectorDeducciones {
  id: string;
  ejercicio: number;
  rfc: string;
  ingresos: number;
  etiquetas: Record<string, EtiquetaCfdi>;
  cfdis: string[];
  esperado: ResultadoDeducciones;
}

interface VectoresE13 {
  config_prueba: ConfigDeducciones & { descripcion: string };
  parsear: { archivo: string; esperado: CfdiLeido | { error: string } }[];
  deducciones: VectorDeducciones[];
}

const e13 = cargarVectores()['E13'] as VectoresE13;
const config = e13.config_prueba;

/** Los CFDI de entrada son la salida de E13.1 que trae el propio vector (`E13.parsear`), por archivo. */
function cfdiDe(archivo: string): CfdiLeido {
  const v = e13.parsear.find((p) => p.archivo === archivo);
  if (!v || 'error' in v.esperado) throw new Error(`falta el CFDI ${archivo}`);
  return v.esperado;
}

const porId = (id: string): VectorDeducciones => {
  const v = e13.deducciones.find((x) => x.id === id);
  if (!v) throw new Error(`falta el vector ${id}`);
  return v;
};

const UUID = (n: number) => `5A1B2C3D-0000-4000-8000-00000000000${n}`;
const base = porId('E13-10');
const todos = base.cfdis.map(cfdiDe);
const uno = (n: number): CfdiLeido => {
  const c = todos.find((x) => x.uuid === UUID(n));
  if (!c) throw new Error(`falta ${n}`);
  return c;
};
const estimar = (
  cfdis: CfdiParaDeducir[],
  etiquetas: Record<string, EtiquetaCfdi> = {},
  ingresos = base.ingresos,
) => estimarDeducciones(cfdis, ingresos, 2026, base.rfc, config, etiquetas);

describe('E13.2 estimarDeducciones', () => {
  it('cubre todos los vectores E13.deducciones por id', () => {
    expect(e13.deducciones.map((v) => v.id).sort()).toEqual(['E13-10', 'E13-11', 'E13-12']);
  });

  for (const id of ['E13-10', 'E13-11', 'E13-12']) {
    it(`${id} reproduce el vector`, () => {
      const v = porId(id);
      const r = estimarDeducciones(v.cfdis.map(cfdiDe), v.ingresos, v.ejercicio, v.rfc, config, v.etiquetas);
      expect(r).toEqual(v.esperado);
    });
  }

  it('el resultado no depende del orden de entrada (fecha, uuid)', () => {
    const v = porId('E13-12');
    const r = estimarDeducciones(
      v.cfdis.map(cfdiDe).reverse(),
      v.ingresos,
      v.ejercicio,
      v.rfc,
      config,
      v.etiquetas,
    );
    expect(r).toEqual(v.esperado);
  });

  it('exclusiones en orden: tipo, receptor, ejercicio, cancelado, moneda', () => {
    const c = uno(1);
    const r = estimar([
      { ...c, uuid: 'A', tipo_comprobante: 'E', receptor_rfc: 'OTRO' },
      { ...c, uuid: 'B', receptor_rfc: 'XAXX010101000', fecha: '2025-12-31' },
      { ...c, uuid: 'C', fecha: '2025-12-31', estatus: 'cancelado' },
      { ...c, uuid: 'D', estatus: 'cancelado', moneda: 'USD' },
      { ...c, uuid: 'E', moneda: 'USD', uso_cfdi: 'G03' },
      { ...c, uuid: 'F', estatus: 'vigente', moneda: null },
    ]);
    // Orden de salida: (fecha, uuid); B y C son de 2025.
    expect(r.excluidos).toEqual([
      { uuid: 'B', motivo: 'otro_receptor' },
      { uuid: 'C', motivo: 'otro_ejercicio' },
      { uuid: 'A', motivo: 'no_es_ingreso' },
      { uuid: 'D', motivo: 'cancelado' },
      { uuid: 'E', motivo: 'moneda_extranjera' },
    ]);
    expect(r.por_uso['D01']?.cfdis).toBe(1);
  });

  it('el RFC del usuario se compara sin espacios ni minúsculas', () => {
    const r = estimarDeducciones([uno(1)], base.ingresos, 2026, ' pepj800101ab1 ', config, {});
    expect(r.excluidos).toEqual([]);
  });

  it('forma de pago: efectivo, otra no electrónica y uso que no exige pago electrónico', () => {
    const r = estimar([
      { ...uno(1), uuid: 'A', forma_pago: '01' },
      { ...uno(1), uuid: 'B', forma_pago: '99' },
      { ...uno(1), uuid: 'C', forma_pago: null },
      { ...uno(1), uuid: 'D', forma_pago: '01', uso_cfdi: 'D07' },
    ]);
    expect(r.excluidos).toEqual([
      { uuid: 'A', motivo: 'pago_en_efectivo' },
      { uuid: 'B', motivo: 'forma_de_pago_no_valida' },
      { uuid: 'C', motivo: 'forma_de_pago_no_valida' },
    ]);
    expect(r.por_uso['D07']).toEqual({ cfdis: 1, bruto: 150000, deducible: 150000, en_tope_global: true });
  });

  it('PPD: sin pago confirmado se excluye; confirmado en efectivo se revisa la forma real (E13-12)', () => {
    const ppd = uno(8);
    expect(estimar([ppd], { [ppd.uuid]: { pagado: false, forma_pago: '03' } }).excluidos).toEqual([
      { uuid: ppd.uuid, motivo: 'ppd_sin_pago' },
    ]);
    expect(estimar([ppd], { [ppd.uuid]: { pagado: true, forma_pago: '01' } }).excluidos).toEqual([
      { uuid: ppd.uuid, motivo: 'pago_en_efectivo' },
    ]);
    expect(estimar([ppd], { [ppd.uuid]: { pagado: true } }).excluidos).toEqual([
      { uuid: ppd.uuid, motivo: 'forma_de_pago_no_valida' },
    ]);
    // En un PUE la forma de pago es la del CFDI aunque la etiqueta diga otra.
    const pue = uno(1);
    expect(estimar([pue], { [pue.uuid]: { pagado: true, forma_pago: '01' } }).excluidos).toEqual([]);
  });

  it('colegiaturas: sin alumno o con nivel desconocido se excluyen', () => {
    const c = uno(4);
    const r = estimar(
      [
        { ...c, uuid: 'A' },
        { ...c, uuid: 'B' },
        { ...c, uuid: 'C' },
      ],
      {
        A: { nivel: 'primaria' },
        B: { alumno: 'ana', nivel: 'doctorado' },
        C: { alumno: '', nivel: 'primaria' },
      },
    );
    expect(r.excluidos.map((e) => e.motivo)).toEqual([
      'falta_alumno_nivel',
      'falta_alumno_nivel',
      'falta_alumno_nivel',
    ]);
    expect(r.por_uso['D10']).toBeUndefined();
  });

  it('colegiaturas: tope por alumno y, con dos niveles en el año, el mayor', () => {
    const c = uno(4);
    const r = estimar(
      [
        { ...c, uuid: 'A', total: 1000000 },
        { ...c, uuid: 'B', total: 1500000 },
        { ...c, uuid: 'C', total: 500000 },
      ],
      {
        A: { alumno: 'ana', nivel: 'primaria' },
        B: { alumno: 'ana', nivel: 'secundaria' },
        C: { alumno: 'luis', nivel: 'preescolar' },
      },
    );
    // ana: 2,500,000 con tope de secundaria 1,990,000; luis: 500,000 bajo su tope.
    expect(r.por_uso['D10']).toEqual({ cfdis: 3, bruto: 3000000, deducible: 2490000, en_tope_global: false });
    expect(r.total_deducible).toBe(2490000);
  });

  it('lentes: tope por beneficiario por año, en orden de fecha', () => {
    const c = uno(3);
    const r = estimar(
      [
        { ...c, uuid: 'A', fecha: '2026-02-01', total: 200000 },
        { ...c, uuid: 'B', fecha: '2026-03-01', total: 200000 },
        { ...c, uuid: 'C', fecha: '2026-03-01', total: 100000 },
        { ...c, uuid: 'D', fecha: '2026-04-01', total: 100000 },
      ],
      {
        A: { lentes: true },
        B: { lentes: true, beneficiario: 'titular' },
        C: { lentes: true, beneficiario: 'hija' },
        D: { lentes: false },
      },
    );
    // titular: 200,000 + 50,000 (tope 250,000); hija: 100,000; D no son lentes: 100,000.
    expect(r.por_uso['D01']).toEqual({ cfdis: 4, bruto: 600000, deducible: 450000, en_tope_global: true });
  });

  it('topes por uso: porcentaje de ingresos, UMA y fijo (el menor)', () => {
    const c = uno(1);
    const r = estimar(
      [
        { ...c, uuid: 'A', uso_cfdi: 'D03', total: 5000000 },
        { ...c, uuid: 'B', uso_cfdi: 'D04', total: 5000000 },
        { ...c, uuid: 'C', uso_cfdi: 'D06', total: 5000000 },
        { ...c, uuid: 'D', uso_cfdi: 'D09', total: 20000000 },
        { ...c, uuid: 'E', uso_cfdi: 'D02', total: 123400 },
      ],
      {},
      10000000,
    );
    expect(r.por_uso['D03']?.deducible).toBe(4279464); // 1 UMA
    expect(r.por_uso['D04']?.deducible).toBe(700000); // 7 % de los ingresos
    expect(r.por_uso['D06']?.deducible).toBe(1000000); // min(10 %, 5 UMA)
    expect(r.por_uso['D09']?.deducible).toBe(15200000); // fijo
    expect(r.por_uso['D02']?.deducible).toBe(123400); // sin tope propio
    // Tope global: min(5 UMA, 15 % de 100,000) = 1,500,000 sobre D03 (4,279,464).
    expect(r.tope_global).toBe(1500000);
    expect(r.sujeto_a_tope_global).toBe(4279464);
    expect(r.excedente_perdido).toBe(2779464);
    expect(r.total_deducible).toBe(1500000 + 700000 + 1000000 + 15200000 + 123400);
  });

  it('el tope global con ingresos de 0 deja fuera todo lo sujeto a él', () => {
    const r = estimar([uno(1)], {}, 0);
    expect(r.tope_global).toBe(0);
    expect(r.total_deducible).toBe(0);
    expect(r.excedente_perdido).toBe(150000);
  });

  it('sin CFDI no hay deducciones', () => {
    expect(estimar([])).toEqual({
      por_uso: {},
      excluidos: [],
      sujeto_a_tope_global: 0,
      tope_global: 4500000,
      excedente_perdido: 0,
      total_deducible: 0,
    });
  });

  it('rechaza entradas inválidas con ErrorDominio', () => {
    expect(() => estimar([], {}, -1)).toThrow(expect.objectContaining({ codigo: 'monto_invalido' }));
    expect(() => estimar([{ ...uno(1), total: 1.5 }])).toThrow(
      expect.objectContaining({ codigo: 'monto_invalido' }),
    );
    expect(() => estimarDeducciones([], 0, 2026.5, base.rfc, config, {})).toThrow(
      expect.objectContaining({ codigo: 'ejercicio_invalido' }),
    );
    expect(() => estimar([{ ...uno(1), fecha: '14/03/2026' }])).toThrow(
      expect.objectContaining({ codigo: 'fecha_invalida' }),
    );
    expect(() => estimarDeducciones([], 0, 2026, base.rfc, { ...config, tope_global: {} }, {})).toThrow(
      expect.objectContaining({ codigo: 'config_fiscal_invalida' }),
    );
  });
});
