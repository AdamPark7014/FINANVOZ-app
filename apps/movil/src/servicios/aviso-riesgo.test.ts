import { describe, expect, it } from 'vitest';
import { sumarDias, type PlainDate } from '@cartera/core';
import { puertoEnMemoria } from '../avisos/puerto';
import { planAvisoRiesgo, sincronizarAvisoRiesgo } from './aviso-riesgo';
import { fijarPreferenciasAvisos } from './avisos-tarjetas';
import { registrarMovimiento } from './formulario';
import { obtenerProbabilidadHoy } from './probabilidad';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

const sinEspera = { ceder: () => Promise.resolve() };

/** e4-01 con `dias` de gasto diario en efectivo desde el 11 oct y el reloj en el día siguiente al último. */
function conHistorial(montoDiario: number, hasta: PlainDate) {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  for (let f: PlainDate = e.hoy; f < hasta; f = sumarDias(f, 1)) {
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: e.cuentas['efectivo'] as string,
      monto: montoDiario,
      fecha: f,
    });
  }
  p.reloj.fijar(hasta);
  return p;
}

describe('aviso de riesgo de no llegar (02 §13)', () => {
  it('con P < 50 % Hoy marca el riesgo y queda programado un aviso por horizonte, sin cifras', async () => {
    // Gasto alto todos los días: el dinero libre no alcanza al siguiente ingreso.
    const p = conHistorial(40_000, '2026-10-27');
    const v = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    if (v.estado !== 'ok') throw new Error(v.estado);
    expect(v.riesgo).toBe(true);
    const puerto = puertoEnMemoria();
    await sincronizarAvisoRiesgo(p.ctx, puerto, '10:00');
    const [aviso, ...otros] = puerto.lista();
    expect(otros).toEqual([]);
    expect(aviso).toMatchObject({
      id: `riesgo:${v.horizonte.fin}`,
      fecha: '2026-10-28',
      hora: '09:00',
      titulo: 'Podrías no llegar a tu quincena',
    });
    expect(`${aviso?.titulo} ${aviso?.cuerpo}`).not.toMatch(/\$|%/);

    // Idempotente; ya enviado, no se repite en el mismo horizonte.
    expect(await sincronizarAvisoRiesgo(p.ctx, puerto, '10:00')).toMatchObject({ programadas: [] });
    p.reloj.fijar('2026-10-28');
    await obtenerProbabilidadHoy(p.ctx, sinEspera);
    expect(planAvisoRiesgo(p.ctx, '10:00')).toEqual([]);
  });

  it('apagado en Ajustes o con P ≥ 50 % no programa nada y cancela el pendiente', async () => {
    const p = conHistorial(40_000, '2026-10-27');
    await obtenerProbabilidadHoy(p.ctx, sinEspera);
    const puerto = puertoEnMemoria();
    await sincronizarAvisoRiesgo(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toHaveLength(1);
    fijarPreferenciasAvisos(p.ctx, { riesgo: false });
    await sincronizarAvisoRiesgo(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toEqual([]);

    const holgado = conHistorial(1_000, '2026-10-27');
    const v = await obtenerProbabilidadHoy(holgado.ctx, sinEspera);
    if (v.estado !== 'ok') throw new Error(v.estado);
    expect(v.riesgo).toBe(false);
    expect(planAvisoRiesgo(holgado.ctx, '10:00')).toEqual([]);
  });

  it('sin probabilidad calculada no toca nada; con menos de 14 días no hay aviso', async () => {
    const p = conHistorial(40_000, '2026-10-27');
    expect(planAvisoRiesgo(p.ctx, '10:00')).toBeNull();
    const nuevo = conHistorial(40_000, '2026-10-15');
    expect(planAvisoRiesgo(nuevo.ctx, '10:00')).toEqual([]);
  });
});
