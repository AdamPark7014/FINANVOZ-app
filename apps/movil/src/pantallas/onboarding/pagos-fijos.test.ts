import { describe, expect, it } from 'vitest';
import {
  capitalizar,
  describirRegla,
  equivalenteMensual,
  hastaDePago,
  leerPagosRestantes,
  limpiarNombrePago,
  OPCIONES_FRECUENCIA_PAGO,
  OPCIONES_MES,
  reglaDePago,
  RESPUESTAS_PAGO_INICIALES,
  totalMensual,
} from './pagos-fijos';

describe('O5 · pagos fijos: respuestas → regla', () => {
  it('cada mes necesita el día (1–31)', () => {
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, diaMes: '5' })).toEqual({ tipo: 'mensual', dia: 5 });
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, diaMes: '' })).toBeNull();
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, diaMes: '32' })).toBeNull();
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, diaMes: '0' })).toBeNull();
  });

  it('cada quincena no pide nada más (15 y último)', () => {
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'quincenal' })).toEqual({
      tipo: 'quincenal_15_ultimo',
    });
  });

  it('cada semana necesita el día de la semana', () => {
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'semanal' })).toBeNull();
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'semanal', diaSemana: 1 })).toEqual({
      tipo: 'semanal',
      dia_semana: 1,
    });
  });

  it('cada año necesita mes y día', () => {
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'anual', mes: 3 })).toBeNull();
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'anual', diaMes: '5' })).toBeNull();
    expect(reglaDePago({ ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'anual', mes: 3, diaMes: '5' })).toEqual({
      tipo: 'anual',
      mes: 3,
      dia: 5,
    });
  });

  it('las opciones de frecuencia y de mes están completas', () => {
    expect(OPCIONES_FRECUENCIA_PAGO.map((o) => o.valor)).toEqual([
      'mensual',
      'quincenal',
      'semanal',
      'anual',
    ]);
    expect(OPCIONES_MES).toHaveLength(12);
    expect(OPCIONES_MES[0]).toEqual({ valor: 1, etiqueta: 'Ene' });
    expect(OPCIONES_MES[11]).toEqual({ valor: 12, etiqueta: 'Dic' });
  });
});

describe('O5 · pagos fijos: fin, total y etiquetas', () => {
  it('cuántos pagos faltan: vacío = sin fin; 0 o texto = no vale', () => {
    expect(leerPagosRestantes('')).toBeNull();
    expect(leerPagosRestantes('  ')).toBeNull();
    expect(leerPagosRestantes('12')).toBe(12);
    expect(leerPagosRestantes('0')).toBeUndefined();
    expect(leerPagosRestantes('doce')).toBeUndefined();
  });

  it('hasta = fecha del último pago contado desde hoy', () => {
    expect(hastaDePago({ tipo: 'mensual', dia: 5 }, '2026-10-21', 3)).toBe('2027-01-05');
    expect(hastaDePago({ tipo: 'mensual', dia: 25 }, '2026-10-21', 1)).toBe('2026-10-25');
    expect(hastaDePago({ tipo: 'semanal', dia_semana: 1 }, '2026-10-21', 2)).toBe('2026-11-02');
  });

  it('equivalente mensual redondea hacia arriba (regla 12)', () => {
    expect(equivalenteMensual(100_00, { tipo: 'mensual', dia: 1 })).toBe(100_00);
    expect(equivalenteMensual(100_00, { tipo: 'quincenal_15_ultimo' })).toBe(200_00);
    expect(equivalenteMensual(100_00, { tipo: 'semanal', dia_semana: 1 })).toBe(433_34);
    expect(equivalenteMensual(1_000_00, { tipo: 'anual', mes: 1, dia: 1 })).toBe(83_34);
    expect(equivalenteMensual(100_00, { tipo: 'catorcenal', ancla: '2026-10-21' })).toBe(216_67);
    expect(
      totalMensual([
        { monto: 100_00, regla: { tipo: 'mensual', dia: 1 } },
        { monto: 100_00, regla: { tipo: 'quincenal_15_ultimo' } },
      ]),
    ).toBe(300_00);
  });

  it('describe la regla como se dice', () => {
    expect(describirRegla({ tipo: 'mensual', dia: 5 })).toBe('día 5 de cada mes');
    expect(describirRegla({ tipo: 'quincenal_15_ultimo' })).toBe('los días 15 y último');
    expect(describirRegla({ tipo: 'semanal', dia_semana: 3 })).toBe('cada miércoles');
    expect(describirRegla({ tipo: 'anual', mes: 3, dia: 5 })).toBe('cada 5 de marzo');
  });

  it('nombre: recorta, colapsa espacios y acota a 60', () => {
    expect(limpiarNombrePago('  Netflix   familiar ')).toBe('Netflix familiar');
    expect(limpiarNombrePago('   ')).toBeNull();
    expect(limpiarNombrePago('x'.repeat(61))).toBeNull();
    expect(capitalizar('renta')).toBe('Renta');
  });
});
