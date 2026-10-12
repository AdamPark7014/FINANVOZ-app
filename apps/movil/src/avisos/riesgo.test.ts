import { describe, expect, it } from 'vitest';
import { planificarAvisoRiesgo, type EntradaAvisoRiesgo } from './riesgo';

const BASE: EntradaAvisoRiesgo = {
  hoy: '2026-10-11',
  horaActual: '10:30',
  porcentaje: 42,
  horizonteFin: '2026-10-15',
  concepto: 'quincena',
  activo: true,
  enviado: null,
};

describe('aviso de riesgo de no llegar (02 §13: P < 50 %, 1 por horizonte)', () => {
  it('con P < 50 % lo programa a la hora de los avisos del día siguiente, sin cifras', () => {
    const r = planificarAvisoRiesgo(BASE);
    expect(r).toEqual({
      id: 'riesgo:2026-10-15',
      tipo: 'riesgo',
      referencia: '2026-10-15',
      fecha: '2026-10-12',
      hora: '09:00',
      titulo: 'Podrías no llegar a tu quincena',
      cuerpo: 'Con lo que sueles gastar, es probable que tengas que tocar tu colchón. Revisa qué viene.',
    });
    expect(`${r?.titulo} ${r?.cuerpo}`).not.toMatch(/\$|\d+ ?%/);
  });

  it('si el día apenas empieza, sale hoy a la hora de los avisos', () => {
    expect(planificarAvisoRiesgo({ ...BASE, horaActual: '07:10' })).toMatchObject({
      fecha: '2026-10-11',
      hora: '09:00',
    });
  });

  it('respeta el horario silencioso y la hora preferida', () => {
    expect(
      planificarAvisoRiesgo({
        ...BASE,
        horaPreferida: '07:00',
        silencio: { inicio: '22:00', fin: '08:30' },
      }),
    ).toMatchObject({ fecha: '2026-10-12', hora: '08:30' });
  });

  it('con P ≥ 50 %, apagado o sin día antes del ingreso, no hay aviso', () => {
    expect(planificarAvisoRiesgo({ ...BASE, porcentaje: 50 })).toBeNull();
    expect(planificarAvisoRiesgo({ ...BASE, activo: false })).toBeNull();
    // Mañana ya es el día de pago: el horizonte se acaba.
    expect(planificarAvisoRiesgo({ ...BASE, horizonteFin: '2026-10-12' })).toBeNull();
  });

  it('uno por horizonte: si ya salió, no se repite; si sigue pendiente, se conserva su momento', () => {
    const enviado = { fin: '2026-10-15', fecha: '2026-10-11', hora: '09:00' };
    expect(planificarAvisoRiesgo({ ...BASE, enviado })).toBeNull();
    const pendiente = { fin: '2026-10-15', fecha: '2026-10-12', hora: '09:00' };
    expect(planificarAvisoRiesgo({ ...BASE, horaActual: '23:00', enviado: pendiente })).toMatchObject({
      fecha: '2026-10-12',
      hora: '09:00',
    });
    // Otro horizonte: vuelve a avisar.
    expect(
      planificarAvisoRiesgo({ ...BASE, enviado: { fin: '2026-09-30', fecha: '2026-09-28', hora: '09:00' } }),
    ).not.toBeNull();
  });
});
