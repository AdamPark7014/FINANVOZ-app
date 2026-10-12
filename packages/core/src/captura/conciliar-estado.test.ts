import { describe, expect, it } from 'vitest';
import { CUENTA_POR_ASIGNAR, CUENTA_POR_ASIGNAR_ENTRADAS } from '../deduplicacion';
import {
  completarConEstado,
  deudaComparableAlCorte,
  sentidoDeRenglon,
  type MovimientoExistente,
} from './conciliar-estado';
import type { MovimientoEstado } from './estados-cuenta';

const T = 'tarjeta:oro';
const renglon = (
  indice: number,
  fecha: string,
  descripcion: string,
  monto: number,
  tipo: MovimientoEstado['tipo'] = 'cargo',
): MovimientoEstado => ({ indice, fecha, descripcion, monto, tipo });
const existente = (
  id: string,
  fecha: string,
  monto: number,
  comercio: string | null,
  extra: Partial<MovimientoExistente> = {},
): MovimientoExistente => ({ id, cuenta: T, monto, fecha, comercio, sentido: 'salida', ...extra });

describe('E9.3 con los renglones de un estado de cuenta (07 §8)', () => {
  it('fusiona con el mismo comercio a Δ ≤ 1, pregunta a Δ = 2 y agrega lo que no está', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [
        renglon(0, '2026-09-11', 'OXXO REFORMA 4521', 8950),
        renglon(1, '2026-09-12', 'UBER TRIP', 8700),
        renglon(2, '2026-09-13', 'STARBUCKS INSURGENTES', 9800),
      ],
      existentes: [
        existente('a', '2026-09-12', 8950, 'OXXO REFORMA'),
        existente('b', '2026-09-14', 8700, 'UBER'),
      ],
    });
    expect(d).toStrictEqual([
      { indice: 0, decision: 'existente', transaccion: 'a', puente: false },
      { indice: 1, decision: 'dudoso', transaccion: 'b', puente: false },
      { indice: 2, decision: 'nuevo' },
    ]);
  });

  it('uno a uno: dos cafés iguales y uno solo registrado → uno existe y el otro es nuevo', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [
        renglon(0, '2026-10-01', 'STARBUCKS', 10400),
        renglon(1, '2026-10-01', 'STARBUCKS', 10400),
      ],
      existentes: [existente('a', '2026-10-01', 10400, 'STARBUCKS')],
    });
    expect(d.map((x) => x.decision)).toStrictEqual(['existente', 'nuevo']);
  });

  it('con varias candidatas gana la de menor Δ y luego la registrada primero', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [renglon(0, '2026-10-02', 'UBER TRIP', 5000)],
      existentes: [
        existente('lejos', '2026-10-03', 5000, 'UBER TRIP'),
        existente('primero', '2026-10-02', 5000, null),
        existente('segundo', '2026-10-02', 5000, null),
      ],
    });
    expect(d[0]).toMatchObject({ decision: 'existente', transaccion: 'primero' });
  });

  it('un gasto dictado sin método (por_asignar) se fusiona y pasa a la tarjeta; un pago se busca entre las entradas', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [
        renglon(0, '2026-09-20', 'LIVERPOOL INSURGENTES', 189900),
        renglon(1, '2026-09-15', 'SU PAGO GRACIAS', 1200000, 'pago'),
        renglon(2, '2026-09-24', 'DEVOLUCION LIVERPOOL', 45000, 'abono'),
      ],
      existentes: [
        existente('dictado', '2026-09-20', 189900, 'liverpool', { cuenta: CUENTA_POR_ASIGNAR }),
        // Un cargo del mismo monto no es candidato para un pago.
        existente('cargo', '2026-09-15', 1200000, null),
        existente('pago', '2026-09-15', 1200000, null, { sentido: 'entrada' }),
        existente('reembolso', '2026-09-25', 45000, null, {
          sentido: 'entrada',
          cuenta: CUENTA_POR_ASIGNAR_ENTRADAS,
        }),
      ],
    });
    expect(d).toStrictEqual([
      { indice: 0, decision: 'existente', transaccion: 'dictado', puente: true },
      { indice: 1, decision: 'existente', transaccion: 'pago', puente: false },
      { indice: 2, decision: 'existente', transaccion: 'reembolso', puente: true },
    ]);
  });

  it('una cuota MSI (subcuenta de la tarjeta) cuenta como la tarjeta; otra cuenta no es compatible', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [renglon(0, '2026-09-20', 'COLCHONES', 720000), renglon(1, '2026-09-21', 'CINE', 28000)],
      existentes: [
        existente('msi', '2026-09-20', 720000, 'COLCHONES', { cuenta: 'msi:1', cuentaRaiz: T }),
        existente('debito', '2026-09-21', 28000, 'CINE', { cuenta: 'debito:1' }),
      ],
    });
    expect(d.map((x) => x.decision)).toStrictEqual(['existente', 'nuevo']);
  });

  it('lo ya revisado y lo anterior al alta no se vuelven a proponer', () => {
    const d = completarConEstado({
      tarjeta: T,
      movimientos: [
        renglon(0, '2026-09-01', 'A', 100),
        renglon(1, '2026-09-11', 'B', 100),
        renglon(2, '2026-09-12', 'C', 100),
      ],
      existentes: [],
      revisados: new Set([1]),
      alta: '2026-09-10',
    });
    expect(d).toStrictEqual([
      { indice: 0, decision: 'anterior' },
      { indice: 1, decision: 'revisado' },
      { indice: 2, decision: 'nuevo' },
    ]);
  });

  it('sentido de cada tipo de renglón', () => {
    expect(
      ['cargo', 'comision', 'pago', 'abono'].map((tipo) => sentidoDeRenglon({ tipo } as MovimientoEstado)),
    ).toStrictEqual(['salida', 'salida', 'entrada', 'entrada']);
  });
});

describe('saldo al corte comparable con el del banco', () => {
  it('suma lo que el libro fechó después del corte y resta lo que el banco todavía no factura', () => {
    expect(
      deudaComparableAlCorte({
        corte: '2026-10-10',
        deudaLibroAlCorte: 400000,
        vinculados: [
          { fecha: '2026-10-11', deuda: 5000 }, // el banco lo cargó el 10; el libro, el 11
          { fecha: '2026-10-10', deuda: 9999 }, // ya está en el libro al corte
        ],
        sinRenglonCercaDelCorte: [
          { fecha: '2026-10-10', deuda: 3000 }, // el banco lo factura el siguiente periodo
          { fecha: '2026-10-09', deuda: -1000 }, // un abono que el banco todavía no aplica
          { fecha: '2026-10-08', deuda: 7000 }, // fuera de la ventana: sí debió facturarse
          { fecha: '2026-10-11', deuda: 2000 }, // después del corte: no está en la deuda del libro al corte
        ],
      }),
    ).toBe(400000 + 5000 - 3000 + 1000);
  });
});
