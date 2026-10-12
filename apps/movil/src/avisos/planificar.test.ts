import { describe, expect, it } from 'vitest';
import {
  enSilencio,
  fueraDeSilencio,
  HORARIO_SILENCIOSO_POR_OMISION,
  planificarAvisosTarjetas,
  type TarjetaParaAvisos,
} from './planificar';
import { crearPuertoExpo, puertoEnMemoria, sincronizarAvisos, type ModuloNotificaciones } from './puerto';

const oro: TarjetaParaAvisos = {
  id: 'tarj_oro',
  nombre: 'Banamex Oro',
  ciclo: { diaCorte: 10, diasParaPagar: 20 },
  pngiPorCorte: { '2026-10-10': 120_000 },
};

describe('horario silencioso', () => {
  it('22:00–08:00 cruza la medianoche', () => {
    const s = HORARIO_SILENCIOSO_POR_OMISION;
    expect(enSilencio('23:30', s)).toBe(true);
    expect(enSilencio('07:59', s)).toBe(true);
    expect(enSilencio('08:00', s)).toBe(false);
    expect(enSilencio('21:59', s)).toBe(false);
    expect(enSilencio('12:00', { inicio: '13:00', fin: '15:00' })).toBe(false);
    expect(enSilencio('14:00', { inicio: '13:00', fin: '15:00' })).toBe(true);
  });

  it('mueve el aviso al final del silencio: de noche al día siguiente, de madrugada el mismo día', () => {
    const s = HORARIO_SILENCIOSO_POR_OMISION;
    expect(fueraDeSilencio('2026-10-12', '23:00', s)).toEqual({ fecha: '2026-10-13', hora: '08:00' });
    expect(fueraDeSilencio('2026-10-12', '06:00', s)).toEqual({ fecha: '2026-10-12', hora: '08:00' });
    expect(fueraDeSilencio('2026-10-12', '09:00', s)).toEqual({ fecha: '2026-10-12', hora: '09:00' });
  });
});

describe('planificarAvisosTarjetas', () => {
  const base = { hoy: '2026-10-12', horaActual: '10:00', tarjetas: [oro] };

  it('corte el día del corte y fecha límite 3 días antes con el PNGI; 1 por tarjeta y periodo', () => {
    const plan = planificarAvisosTarjetas(base);
    expect(plan.map((a) => [a.id, a.fecha, a.hora])).toEqual([
      ['tarjeta:limite:tarj_oro:2026-10-30', '2026-10-27', '09:00'],
      ['tarjeta:corte:tarj_oro:2026-11-10', '2026-11-10', '09:00'],
      ['tarjeta:limite:tarj_oro:2026-11-30', '2026-11-27', '09:00'],
      ['tarjeta:corte:tarj_oro:2026-12-10', '2026-12-10', '09:00'],
    ]);
    expect(plan[0]?.cuerpo).toContain('1,200');
    expect(plan[2]?.cuerpo).toBe('Revisa cuánto pagar para no generar intereses.');
    expect(new Set(plan.map((a) => a.id)).size).toBe(plan.length);
    expect(planificarAvisosTarjetas(base)).toEqual(plan);
  });

  it('una hora preferida dentro del silencio sale al terminar el silencio', () => {
    const plan = planificarAvisosTarjetas({ ...base, horaPreferida: '23:00' });
    expect(plan[0]).toMatchObject({ referencia: '2026-10-30', fecha: '2026-10-28', hora: '08:00' });
  });

  it('PNGI 0 no avisa la fecha límite; los avisos apagados no salen', () => {
    const pagada = { ...oro, pngiPorCorte: { '2026-10-10': 0 } };
    expect(planificarAvisosTarjetas({ ...base, tarjetas: [pagada] }).map((a) => a.id)).not.toContain(
      'tarjeta:limite:tarj_oro:2026-10-30',
    );
    expect(
      planificarAvisosTarjetas({ ...base, avisarCorte: false }).every((a) => a.tipo === 'fecha_limite'),
    ).toBe(true);
    expect(planificarAvisosTarjetas({ ...base, avisarLimite: false }).every((a) => a.tipo === 'corte')).toBe(
      true,
    );
  });

  it('lo que ya salió hoy no se reprograma', () => {
    const plan = planificarAvisosTarjetas({ ...base, hoy: '2026-10-27', horaActual: '09:30' });
    expect(plan.map((a) => a.id)).not.toContain('tarjeta:limite:tarj_oro:2026-10-30');
  });
});

describe('sincronizarAvisos', () => {
  it('es idempotente y solo toca las notificaciones con su prefijo', async () => {
    const puerto = puertoEnMemoria();
    await puerto.programar({ id: 'otro:1', fecha: '2026-10-20', hora: '09:00', titulo: 'x', cuerpo: 'y' });
    const plan = planificarAvisosTarjetas({ hoy: '2026-10-12', horaActual: '10:00', tarjetas: [oro] });
    const r1 = await sincronizarAvisos(puerto, plan, 'tarjeta:');
    expect(r1.programadas).toHaveLength(4);
    const r2 = await sincronizarAvisos(puerto, plan, 'tarjeta:');
    expect(r2).toEqual({ programadas: [], canceladas: [], sinCambio: r1.programadas });
    // El PNGI cambia: se reprograma solo ese aviso.
    const nuevo = planificarAvisosTarjetas({
      hoy: '2026-10-12',
      horaActual: '10:00',
      tarjetas: [{ ...oro, pngiPorCorte: { '2026-10-10': 50_000 } }],
    });
    const r3 = await sincronizarAvisos(puerto, nuevo, 'tarjeta:');
    expect(r3.canceladas).toEqual(['tarjeta:limite:tarj_oro:2026-10-30']);
    expect(r3.programadas).toEqual(['tarjeta:limite:tarj_oro:2026-10-30']);
    // Sin tarjetas: se cancelan las suyas y la ajena sigue.
    await sincronizarAvisos(puerto, [], 'tarjeta:');
    expect(puerto.lista().map((n) => n.id)).toEqual(['otro:1']);
  });

  it('el adaptador de expo-notifications programa por fecha y recupera fecha y hora de data', async () => {
    const guardadas = new Map<string, Parameters<ModuloNotificaciones['scheduleNotificationAsync']>[0]>();
    const modulo: ModuloNotificaciones = {
      scheduleNotificationAsync: async (s) => {
        guardadas.set(s.identifier, s);
        return s.identifier;
      },
      cancelScheduledNotificationAsync: async (id) => {
        guardadas.delete(id);
      },
      getAllScheduledNotificationsAsync: async () =>
        [...guardadas.values()].map((s) => ({ identifier: s.identifier, content: s.content })),
    };
    const puerto = crearPuertoExpo(modulo);
    const plan = planificarAvisosTarjetas({ hoy: '2026-10-12', horaActual: '10:00', tarjetas: [oro] });
    await sincronizarAvisos(puerto, plan, 'tarjeta:');
    const s = guardadas.get('tarjeta:corte:tarj_oro:2026-11-10');
    expect(s?.trigger.type).toBe('date');
    expect(s?.trigger.date.getDate()).toBe(10);
    expect(s?.trigger.date.getHours()).toBe(9);
    expect((await sincronizarAvisos(puerto, plan, 'tarjeta:')).programadas).toEqual([]);
  });
});
