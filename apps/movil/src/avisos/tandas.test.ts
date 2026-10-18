// Pendiente 40 · `02 §13`: aviso local "Aportación de tanda" el día de la aportación, 1 por ronda.
import { describe, expect, it } from 'vitest';
import {
  CUERPO_AVISO_TANDA,
  planificarAvisosTanda,
  TITULO_AVISO_TANDA,
  type EntradaAvisosTanda,
} from './tandas';

const base: EntradaAvisosTanda = {
  hoy: '2026-10-14',
  horaActual: '10:00',
  activo: true,
  aportaciones: [
    { tandaId: 'tan-1', fecha: '2026-10-16' },
    { tandaId: 'tan-1', fecha: '2026-10-23' },
    { tandaId: 'tan-1', fecha: '2026-10-30' },
  ],
};

describe('aviso de aportación de tanda', () => {
  it('uno por ronda, el día de la aportación a la hora de los avisos', () => {
    expect(planificarAvisosTanda(base).map((a) => [a.id, a.fecha, a.hora])).toEqual([
      ['tanda:tan-1:2026-10-16', '2026-10-16', '09:00'],
      ['tanda:tan-1:2026-10-23', '2026-10-23', '09:00'],
      ['tanda:tan-1:2026-10-30', '2026-10-30', '09:00'],
    ]);
  });

  it('la misma ronda repetida no duplica el aviso y dos tandas el mismo día dan dos avisos', () => {
    const plan = planificarAvisosTanda({
      ...base,
      aportaciones: [
        { tandaId: 'tan-1', fecha: '2026-10-16' },
        { tandaId: 'tan-1', fecha: '2026-10-16' },
        { tandaId: 'tan-2', fecha: '2026-10-16' },
      ],
    });
    expect(plan.map((a) => a.id)).toEqual(['tanda:tan-1:2026-10-16', 'tanda:tan-2:2026-10-16']);
  });

  it('hoy antes de la hora todavía sale; ya pasada la hora o en días pasados, no', () => {
    const hoyMismo = { ...base, aportaciones: [{ tandaId: 'tan-1', fecha: '2026-10-14' }] };
    expect(planificarAvisosTanda({ ...hoyMismo, horaActual: '08:59' }).map((a) => a.fecha)).toEqual([
      '2026-10-14',
    ]);
    expect(planificarAvisosTanda({ ...hoyMismo, horaActual: '09:00' })).toEqual([]);
    expect(
      planificarAvisosTanda({ ...base, aportaciones: [{ tandaId: 'tan-1', fecha: '2026-10-01' }] }),
    ).toEqual([]);
  });

  it('respeta el horario silencioso, la hora elegida y la ventana de planeación', () => {
    const una = { ...base, aportaciones: [{ tandaId: 'tan-1', fecha: '2026-10-16' }] };
    expect(planificarAvisosTanda({ ...una, horaPreferida: '23:00' })[0]).toMatchObject({
      fecha: '2026-10-17',
      hora: '08:00',
    });
    expect(planificarAvisosTanda({ ...una, horaPreferida: '07:30' })[0]).toMatchObject({
      fecha: '2026-10-16',
      hora: '08:00',
    });
    expect(planificarAvisosTanda({ ...base, diasPlaneacion: 10 }).map((a) => a.fecha)).toEqual([
      '2026-10-16',
      '2026-10-23',
    ]);
  });

  it('apagado en Ajustes no programa nada', () => {
    expect(planificarAvisosTanda({ ...base, activo: false })).toEqual([]);
  });

  it('el texto no lleva monto, nombre ni concepto (se ve con el teléfono bloqueado)', () => {
    const [aviso] = planificarAvisosTanda(base);
    expect(aviso).toMatchObject({ titulo: TITULO_AVISO_TANDA, cuerpo: CUERPO_AVISO_TANDA });
    expect(`${aviso?.titulo} ${aviso?.cuerpo}`).not.toMatch(/\$|\d|tan-1/);
  });
});
