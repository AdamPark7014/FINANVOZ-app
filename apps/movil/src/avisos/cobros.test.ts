import { describe, expect, it } from 'vitest';
import { planificarRecordatoriosCobro } from './cobros';

describe('planificarRecordatoriosCobro', () => {
  const base = { hoy: '2026-10-10', horaActual: '10:00' } as const;

  it('uno por persona a la hora de los avisos, en orden de salida', () => {
    expect(
      planificarRecordatoriosCobro({
        ...base,
        recordatorios: [
          { personaId: 'b', fecha: '2026-10-13', saldo: 100 },
          { personaId: 'a', fecha: '2026-10-11', saldo: 100 },
        ],
      }).map((n) => [n.id, n.fecha, n.hora]),
    ).toEqual([
      ['cobro:a', '2026-10-11', '09:00'],
      ['cobro:b', '2026-10-13', '09:00'],
    ]);
  });

  it('omite a quien ya no te debe y lo que ya salió', () => {
    expect(
      planificarRecordatoriosCobro({
        ...base,
        recordatorios: [
          { personaId: 'a', fecha: '2026-10-11', saldo: 0 },
          { personaId: 'b', fecha: '2026-10-10', saldo: 100 },
          { personaId: 'c', fecha: '2026-10-09', saldo: 100 },
          { personaId: 'd', fecha: '2026-10-10', saldo: -100 },
        ],
      }),
    ).toEqual([]);
    // Hoy, todavía antes de la hora del aviso: sí sale.
    expect(
      planificarRecordatoriosCobro({
        ...base,
        horaActual: '07:00',
        recordatorios: [{ personaId: 'b', fecha: '2026-10-10', saldo: 100 }],
      }),
    ).toHaveLength(1);
  });

  it('fuera del horario silencioso', () => {
    expect(
      planificarRecordatoriosCobro({
        ...base,
        horaPreferida: '22:30',
        silencio: { inicio: '22:00', fin: '07:30' },
        recordatorios: [{ personaId: 'a', fecha: '2026-10-11', saldo: 1 }],
      }).map((n) => [n.fecha, n.hora]),
    ).toEqual([['2026-10-12', '07:30']]);
  });
});
