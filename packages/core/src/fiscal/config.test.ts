import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cargarVectores } from '../__pruebas__/vectores';
import { camposPorDefinir, POR_DEFINIR, validarConfigFiscal } from './config';
import { estimarDeducciones, type CfdiLeido, type ConfigDeducciones } from './deducciones';
import { ahorroPorDeducciones, type FilaTarifa } from './isr';

const archivo2026 = (): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../config/fiscal/2026.json', import.meta.url)), 'utf8'),
  ) as unknown;

interface VectoresE13 {
  config_prueba: ConfigDeducciones & { descripcion?: string };
  tarifa_prueba: FilaTarifa[];
  parsear: { archivo: string; esperado: CfdiLeido | { error: string } }[];
  deducciones: {
    id: string;
    cfdis: string[];
    ingresos: number;
    rfc: string;
    etiquetas: Record<string, object>;
    esperado: unknown;
  }[];
  ahorro: { id: string; base_gravable: number; deducciones: number; esperado: unknown }[];
}
const vectores = cargarVectores();
const e13 = vectores['E13'] as VectoresE13;
const e15 = vectores['E15'] as { config: Record<string, unknown> };

function sinDescripcion<T extends { descripcion?: unknown }>(o: T): Omit<T, 'descripcion'> {
  const copia = { ...o };
  delete copia.descripcion;
  return copia;
}

/** Un archivo completo con la forma de `10 §5`, armado con los parámetros sintéticos de los vectores. */
function configSintetica(): Record<string, unknown> {
  const { uma_anual, ...deducciones } = sinDescripcion(e13.config_prueba);
  const e15config = sinDescripcion(e15.config);
  return {
    ejercicio: 2026,
    estado: 'por_validar',
    fuentes: ['vectores'],
    ...e15config,
    tarifa_anual_isr: e13.tarifa_prueba,
    uma: { diaria: 11731, anual: uma_anual },
    deducciones,
  };
}

const codigoDe = (f: () => unknown): string | null => {
  try {
    f();
  } catch (e) {
    return (e as { codigo?: string }).codigo ?? 'sin_codigo';
  }
  return null;
};

describe('config/fiscal/2026.json', () => {
  it('está por validar y falla cerrado mientras tenga parámetros por definir (CA-M12-06)', () => {
    const datos = archivo2026();
    expect((datos as { estado: string }).estado).toBe('por_validar');
    expect(codigoDe(() => validarConfigFiscal(datos, 2026))).toBe('config_fiscal_incompleta');
  });

  it('los parámetros por definir son exactamente los de los pendientes de ESTADO', () => {
    const usos = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09'].flatMap((u) => [
      `deducciones.usos.${u}.en_tope_global`,
      `deducciones.usos.${u}.requiere_pago_electronico`,
      `deducciones.usos.${u}.tope`,
    ]);
    expect(camposPorDefinir(archivo2026()).sort()).toEqual(
      [
        'tarifa_anual_isr[1]',
        'deducciones.tope_global.porcentaje_ingresos_bp',
        'deducciones.tope_lentes_por_beneficiario',
        ...usos,
        'deducciones.usos.D10.en_tope_global',
        'deducciones.usos.D10.requiere_pago_electronico',
        'deducciones.usos.D10.tope_por_alumno_nivel',
      ].sort(),
    );
  });

  it('con los marcadores llenos tiene la forma de 10 §5 (solo falta el contador)', () => {
    // Sustituye cada POR_DEFINIR por un valor de la forma correcta para probar que el resto del archivo es válido.
    const datos = JSON.parse(JSON.stringify(archivo2026())) as Record<string, unknown>;
    (datos['tarifa_anual_isr'] as unknown[])[1] = { limite_inferior: 100, cuota_fija: 2, tasa_bp: 640 };
    const ded = datos['deducciones'] as Record<string, Record<string, unknown>>;
    (ded['tope_global'] as Record<string, unknown>)['porcentaje_ingresos_bp'] = 1;
    ded['tope_lentes_por_beneficiario'] = 1 as never;
    for (const [uso, regla] of Object.entries(ded['usos'] as Record<string, Record<string, unknown>>)) {
      regla['en_tope_global'] = true;
      regla['requiere_pago_electronico'] = true;
      if (uso === 'D10') regla['tope_por_alumno_nivel'] = { primaria: 1 };
      else regla['tope'] = { fijo: 1 };
    }
    const config = validarConfigFiscal(datos, 2026);
    expect(config.deducciones.uma_anual).toBe(config.uma.anual);
    expect(config.deducciones.formas_pago_electronicas).toEqual(['02', '03', '04', '28', '29']);
    expect(config.resico_pf.tabla_mensual).toHaveLength(5);
  });
});

describe('validarConfigFiscal', () => {
  it('la configuración sintética de los vectores reproduce E13-10 y E13-20 a través del cargador', () => {
    const config = validarConfigFiscal(configSintetica(), 2026);
    expect(config.deducciones).toEqual(sinDescripcion(e13.config_prueba));
    const v = e13.deducciones.find((x) => x.id === 'E13-10');
    if (!v) throw new Error('falta E13-10');
    const cfdis = v.cfdis.map((a) => e13.parsear.find((p) => p.archivo === a)?.esperado as CfdiLeido);
    expect(
      estimarDeducciones(cfdis, v.ingresos, config.ejercicio, v.rfc, config.deducciones, v.etiquetas),
    ).toEqual(v.esperado);
    const a = e13.ahorro.find((x) => x.id === 'E13-20');
    expect(ahorroPorDeducciones(a?.base_gravable ?? 0, a?.deducciones ?? 0, config.tarifa_anual_isr)).toEqual(
      a?.esperado,
    );
  });

  it('acepta estado validado', () => {
    expect(validarConfigFiscal({ ...configSintetica(), estado: 'validado' }).estado).toBe('validado');
  });

  it('un POR_DEFINIR en cualquier parte falla cerrado y nombra la ruta', () => {
    const datos = { ...configSintetica(), uma: { diaria: POR_DEFINIR, anual: 1 } };
    expect(() => validarConfigFiscal(datos)).toThrow(/uma\.diaria/);
    expect(camposPorDefinir(POR_DEFINIR)).toEqual(['(raíz)']);
  });

  it('rechaza formas inválidas con config_fiscal_invalida', () => {
    const base = configSintetica();
    const casos: unknown[] = [
      null,
      [],
      { ...base, ejercicio: 2025.5 },
      { ...base, estado: 'firmado' },
      { ...base, fuentes: [] },
      { ...base, fuentes: [''] },
      { ...base, dia_pago: 32 },
      { ...base, iva_tasa_general_bp: 10001 },
      {
        ...base,
        resico_pf: {
          limite_anual: 1,
          tabla_mensual: [
            { hasta: 2, tasa_bp: 1 },
            { hasta: 2, tasa_bp: 1 },
          ],
        },
      },
      { ...base, tarifa_anual_isr: [{ limite_inferior: 5, cuota_fija: 0, tasa_bp: 1 }] },
      { ...base, tarifa_anual_isr: [{ limite_inferior: 0, cuota_fija: '0', tasa_bp: 1 }] },
      { ...base, uma: { diaria: 0, anual: 1 } },
      { ...base, deducciones: { ...(base['deducciones'] as object), tope_global: {} } },
      { ...base, deducciones: { ...(base['deducciones'] as object), usos: {} } },
      {
        ...base,
        deducciones: { ...(base['deducciones'] as object), usos: { D01: { en_tope_global: 'si' } } },
      },
      {
        ...base,
        deducciones: {
          ...(base['deducciones'] as object),
          usos: {
            D10: { en_tope_global: false, requiere_pago_electronico: true, tope_por_alumno_nivel: {} },
          },
        },
      },
    ];
    for (const caso of casos)
      expect(codigoDe(() => validarConfigFiscal(caso))).toBe('config_fiscal_invalida');
    expect(codigoDe(() => validarConfigFiscal(base, 2027))).toBe('config_fiscal_invalida');
  });
});
