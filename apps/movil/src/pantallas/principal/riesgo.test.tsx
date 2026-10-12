import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { sumarDias, type PlainDate } from '@cartera/core';
import {
  obtenerPreferenciasAvisos,
  obtenerProbabilidadHoy,
  registrarMovimiento,
  type Contexto,
} from '../../servicios';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { SeccionAvisos } from '../ajustes/SeccionAvisos';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { activarPlus, conEscenario } from './__pruebas__/base';
import { ProbabilidadHoy, TEXTO_RIESGO } from './ProbabilidadHoy';

const sinEspera = { ceder: () => Promise.resolve() };

function montar(ctx: Contexto, ui: ReactNode, notificaciones = notificacionesEnMemoria()) {
  render(
    <ProveedorNotificaciones notificaciones={notificaciones}>
      <ProveedorSesion ctx={ctx} nube={null}>
        {ui}
      </ProveedorSesion>
    </ProveedorNotificaciones>,
  );
  return notificaciones;
}

/** e4-01 con un gasto diario en efectivo desde el 11 oct y la probabilidad de `hasta` ya calculada. */
async function conGastoDiario(monto: number, hasta: PlainDate) {
  const p = conEscenario('e4-01');
  activarPlus(p.ctx);
  const efectivo = p.e.cuentas['efectivo'] as string;
  for (let f: PlainDate = p.e.hoy; f < hasta; f = sumarDias(f, 1)) {
    registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId: efectivo, monto, fecha: f });
  }
  p.reloj.fijar(hasta);
  await obtenerProbabilidadHoy(p.ctx, sinEspera);
  return p;
}

describe('aviso de riesgo en Hoy (P < 50 %, 02 §13)', () => {
  it('muestra el aviso y deja programada la notificación del siguiente inicio de día', async () => {
    const p = await conGastoDiario(40_000, '2026-10-27');
    const n = montar(p.ctx, <ProbabilidadHoy hora={() => '10:00'} />);
    expect(screen.getByTestId('aviso-riesgo')).toHaveTextContent(TEXTO_RIESGO);
    await waitFor(() => expect(n.puerto.lista()).toHaveLength(1));
    expect(n.puerto.lista()[0]).toMatchObject({
      fecha: '2026-10-28',
      hora: '09:00',
      titulo: 'Podrías no llegar a tu quincena',
    });
  });

  it('con P ≥ 50 % no hay aviso; sin permiso no se programa nada', async () => {
    const p = await conGastoDiario(1_000, '2026-10-27');
    const n = montar(p.ctx, <ProbabilidadHoy hora={() => '10:00'} />);
    expect(screen.getByTestId('probabilidad-texto')).toBeTruthy();
    expect(screen.queryByTestId('aviso-riesgo')).toBeNull();
    await waitFor(() => expect(n.puerto.lista()).toEqual([]));

    const q = await conGastoDiario(40_000, '2026-10-27');
    const sinPermiso = notificacionesEnMemoria('denegado');
    montar(q.ctx, <ProbabilidadHoy hora={() => '10:00'} />, sinPermiso);
    expect(screen.getAllByTestId('aviso-riesgo').length).toBeGreaterThan(0);
    await waitFor(() => expect(sinPermiso.puerto.lista()).toEqual([]));
  });

  it('Ajustes → Avisos apaga "Riesgo de no llegar"', async () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, <SeccionAvisos />);
    await screen.findByTestId('ajustes-aviso-riesgo');
    expect(obtenerPreferenciasAvisos(p.ctx).riesgo).toBe(true);
    fireEvent.press(screen.getByTestId('ajustes-aviso-riesgo'));
    expect(obtenerPreferenciasAvisos(p.ctx).riesgo).toBe(false);
  });
});
