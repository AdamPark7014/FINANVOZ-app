import { describe, expect, it } from 'vitest';
import { compararInterpretacion } from './comparar';

const registrar = (...movimientos: Record<string, unknown>[]) => ({ intencion: 'registrar', movimientos });

describe('compararInterpretacion (docs/06-NLU.md §8)', () => {
  it('la intención debe coincidir', () => {
    expect(
      compararInterpretacion({ intencion: 'arqueo', efectivo_real: 1 }, { intencion: 'registrar' }),
    ).toEqual(['intencion']);
  });

  it('solo compara los campos del esperado y nunca la descripción', () => {
    const esperado = registrar({ tipo: 'gasto', monto: 100, descripcion: 'tacos' });
    expect(
      compararInterpretacion(
        esperado,
        registrar({ tipo: 'gasto', monto: 100, descripcion: 'otra', categoria: 'super' }),
      ),
    ).toEqual([]);
    expect(compararInterpretacion(esperado, registrar({ tipo: 'gasto', monto: 200 }))).toEqual([
      'movimientos[0].monto',
    ]);
  });

  it('misma cantidad de movimientos', () => {
    expect(compararInterpretacion(registrar({ monto: 1 }), registrar({ monto: 1 }, { monto: 2 }))).toEqual([
      'movimientos',
    ]);
  });

  it('origen ausente equivale a desconocido; alias normalizado', () => {
    expect(compararInterpretacion(registrar({ origen: { tipo: 'desconocido' } }), registrar({}))).toEqual([]);
    expect(
      compararInterpretacion(
        registrar({ origen: { tipo: 'credito', alias: 'nu' } }),
        registrar({ origen: { tipo: 'credito', alias: 'la Nu' } }),
      ),
    ).toEqual([]);
    expect(compararInterpretacion(registrar({ origen: { tipo: 'credito' } }), registrar({}))).toEqual([
      'movimientos[0].origen.tipo',
    ]);
  });

  it('contraparte y participantes normalizados', () => {
    expect(
      compararInterpretacion(
        registrar({ contraparte: 'jefa', division: { partes: 3, participantes: ['caro', 'juan'] } }),
        registrar({ contraparte: 'Mi Jefa', division: { partes: 3, participantes: ['Juan', 'Caro'] } }),
      ),
    ).toEqual([]);
  });

  it('texto de referencia contenido en un sentido u otro', () => {
    const esperado = { intencion: 'anular', objetivo: { texto: 'cine' } };
    expect(compararInterpretacion(esperado, { intencion: 'anular', objetivo: { texto: 'el cine' } })).toEqual(
      [],
    );
    expect(compararInterpretacion(esperado, { intencion: 'anular', objetivo: { texto: 'uber' } })).toEqual([
      'objetivo.texto',
    ]);
  });

  it('aclarar: solo el motivo; fuera_de_alcance: sin motivo', () => {
    expect(
      compararInterpretacion(
        { intencion: 'aclarar', motivo: 'monto_faltante', pregunta: 'a' },
        { intencion: 'aclarar', motivo: 'monto_faltante', pregunta: 'b' },
      ),
    ).toEqual([]);
    expect(
      compararInterpretacion(
        { intencion: 'fuera_de_alcance', motivo: 'ajeno' },
        { intencion: 'fuera_de_alcance', motivo: 'instrucciones' },
      ),
    ).toEqual([]);
  });
});
