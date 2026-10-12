// RF-RES-04 · CA-M9-06 (planeación): aviso de respaldo pendiente a los 14 días y uno por semana.
import { describe, expect, it } from 'vitest';
import {
  AVISOS_RESPALDO_ADELANTADOS,
  planificarAvisosRespaldo,
  respaldoPendiente,
  type EntradaAvisoRespaldo,
} from './respaldo';

const base: EntradaAvisoRespaldo = {
  hoy: '2026-10-01',
  horaActual: '12:00',
  desde: '2026-10-01',
  activo: true,
};

describe('aviso de respaldo pendiente', () => {
  it('a los 14 días del último respaldo, luego cada semana, a la hora de los avisos', () => {
    const plan = planificarAvisosRespaldo(base);
    expect(plan.map((a) => [a.id, a.fecha, a.hora])).toEqual([
      ['respaldo:2026-10-15', '2026-10-15', '09:00'],
      ['respaldo:2026-10-22', '2026-10-22', '09:00'],
      ['respaldo:2026-10-29', '2026-10-29', '09:00'],
      ['respaldo:2026-11-05', '2026-11-05', '09:00'],
    ]);
    expect(plan).toHaveLength(AVISOS_RESPALDO_ADELANTADOS);
    // Sin datos en el texto (se ve con el teléfono bloqueado).
    expect(plan[0]?.titulo).toBe('Respalda tus datos');
    expect(plan[0]?.cuerpo).not.toMatch(/\d{3,}|\$/);
  });

  it('el día 14 antes de la hora todavía sale ese día; ya pasada la hora, el siguiente es en una semana', () => {
    expect(planificarAvisosRespaldo({ ...base, hoy: '2026-10-15', horaActual: '08:30' })[0]?.fecha).toBe(
      '2026-10-15',
    );
    expect(planificarAvisosRespaldo({ ...base, hoy: '2026-10-15', horaActual: '09:00' })[0]?.fecha).toBe(
      '2026-10-22',
    );
    // Mucho tiempo sin abrir la app: la serie sigue cada 7 días desde el día 14.
    expect(planificarAvisosRespaldo({ ...base, hoy: '2026-12-01' })[0]?.id).toBe('respaldo:2026-12-03');
  });

  it('respeta la hora preferida y el horario silencioso', () => {
    const [a] = planificarAvisosRespaldo({
      ...base,
      horaPreferida: '23:00',
      silencio: { inicio: '22:00', fin: '08:00' },
    });
    expect([a?.fecha, a?.hora]).toEqual(['2026-10-16', '08:00']);
  });

  it('apagado o sin fecha de referencia (onboarding sin terminar): nada', () => {
    expect(planificarAvisosRespaldo({ ...base, activo: false })).toEqual([]);
    expect(planificarAvisosRespaldo({ ...base, desde: null })).toEqual([]);
  });

  it('respaldoPendiente: 13 días no, 14 sí', () => {
    expect(respaldoPendiente('2026-10-01', '2026-10-14')).toBe(false);
    expect(respaldoPendiente('2026-10-01', '2026-10-15')).toBe(true);
    expect(respaldoPendiente(null, '2026-10-15')).toBe(false);
  });
});
