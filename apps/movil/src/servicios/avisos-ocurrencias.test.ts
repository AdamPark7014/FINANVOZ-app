// Pendiente 40 · `02 §13`: avisos de tanda, compromiso sin cubrir e ingreso que no llegó desde la base real.
import { describe, expect, it } from 'vitest';
import { puertoEnMemoria } from '../avisos/puerto';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { planAvisosOcurrencias, planAvisosTanda, sincronizarAvisosOcurrencias } from './avisos-ocurrencias';
import { fijarPreferenciasAvisos } from './avisos-tarjetas';
import { materializarOcurrencias, yaLaPague } from './ocurrencias';
import { agregarCuenta, agregarPagoFijo, configurarIngreso } from './onboarding';
import { aportarTanda, crearTanda, reglaDeFrecuencia } from './tandas';
import { abrirPrueba } from './__pruebas__/base';

/** Reloj en el mié 14 oct; quincena el día 1, la luz el 20 y una tanda semanal de 4 desde el vie 16. */
function preparar() {
  const p = abrirPrueba('2026-10-14');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 1_000_000 });
  const ingreso = configurarIngreso(p.ctx, {
    monto: 1_500_000,
    regla: { tipo: 'mensual', dia: 1 },
    cuentaId: bbva,
  });
  const luz = agregarPagoFijo(p.ctx, {
    concepto: 'luz',
    monto: 41_000,
    regla: { tipo: 'mensual', dia: 20 },
    cuentaId: bbva,
  });
  const { tandaId } = crearTanda(p.ctx, {
    nombre: 'Tanda de la oficina',
    aportacion: 50_000,
    participantes: 4,
    turno: 2,
    regla: reglaDeFrecuencia('semanal', '2026-10-16'),
    inicio: '2026-10-16',
    cuentaId: bbva,
  });
  materializarOcurrencias(p.ctx);
  return { ...p, bbva, ingreso, luz, tandaId };
}

describe('avisos de ocurrencias (02 §13)', () => {
  it('Aportación de tanda: uno por ronda pendiente, el día de la aportación, sin el nombre de la tanda', () => {
    const p = preparar();
    const plan = planAvisosTanda(p.ctx, '10:00');
    expect(plan.map((a) => [a.id, a.fecha, a.hora])).toEqual([
      [`tanda:${p.tandaId}:2026-10-16`, '2026-10-16', '09:00'],
      [`tanda:${p.tandaId}:2026-10-23`, '2026-10-23', '09:00'],
      [`tanda:${p.tandaId}:2026-10-30`, '2026-10-30', '09:00'],
      [`tanda:${p.tandaId}:2026-11-06`, '2026-11-06', '09:00'],
    ]);
    for (const a of plan) expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\$|\d|oficina/i);
  });

  it('compromisos 1 día después (sin las aportaciones de tanda) e ingreso 3 días después', () => {
    const p = preparar();
    expect(planAvisosOcurrencias(p.ctx, '10:00').map((a) => [a.id, a.fecha])).toEqual([
      [`compromiso:${p.luz}:2026-10-20`, '2026-10-21'],
      [`ingreso:${p.ingreso}:2026-11-01`, '2026-11-04'],
      [`compromiso:${p.luz}:2026-11-20`, '2026-11-21'],
      [`ingreso:${p.ingreso}:2026-12-01`, '2026-12-04'],
    ]);
  });

  it('sincroniza los tres tipos, es idempotente y cancela el aviso de lo que ya se resolvió', async () => {
    const p = preparar();
    const puerto = puertoEnMemoria();
    const r = await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00');
    expect(r.programadas).toHaveLength(8);
    expect((await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00')).programadas).toEqual([]);

    aportarTanda(p.ctx, { tandaId: p.tandaId, fecha: '2026-10-16' });
    yaLaPague(p.ctx, { programadoId: p.luz, fecha: '2026-10-20' });
    const s = await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00');
    expect([...s.canceladas].sort()).toEqual(
      [`compromiso:${p.luz}:2026-10-20`, `tanda:${p.tandaId}:2026-10-16`].sort(),
    );
    expect(s.programadas).toEqual([]);
  });

  it('cada interruptor de Ajustes › Avisos apaga solo los suyos; las otras sincronizaciones no se tocan', async () => {
    const p = preparar();
    const puerto = puertoEnMemoria();
    await puerto.programar({
      id: 'tarjeta:corte:tc:2026-10-20',
      fecha: '2026-10-20',
      hora: '09:00',
      titulo: 't',
      cuerpo: 'c',
    });
    await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00');
    fijarPreferenciasAvisos(p.ctx, { tanda: false, compromiso: false });
    await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00');
    expect(puerto.lista().map((n) => n.id.split(':')[0])).toEqual(['ingreso', 'ingreso', 'tarjeta']);
    fijarPreferenciasAvisos(p.ctx, { ingreso: false });
    await sincronizarAvisosOcurrencias(p.ctx, puerto, '10:00');
    expect(puerto.lista().map((n) => n.id)).toEqual(['tarjeta:corte:tc:2026-10-20']);
  });
});
