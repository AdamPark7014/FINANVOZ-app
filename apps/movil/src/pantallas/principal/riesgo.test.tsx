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
import {
  ETIQUETA_HORARIO_SILENCIOSO,
  PISTA_GUARDAR_HORARIO,
  PISTA_PERMITIR_AVISOS,
  SECCION_AVISOS,
} from '../ajustes/avisos-textos';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { activarPlus, conEscenario } from './__pruebas__/base';
import { etiquetaAccesibleProbabilidad, ProbabilidadHoy } from './ProbabilidadHoy';
import {
  ETIQUETA_PROBABILIDAD_CALCULANDO,
  etiquetaAvisoRiesgo,
  FRASE_MARCA_PROBABILIDAD,
  TEXTO_RIESGO,
} from './textos';

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

describe('ProbabilidadHoy · TalkBack', () => {
  it('etiquetaAccesibleProbabilidad concatena estimación y la marca del 50 %', () => {
    expect(etiquetaAccesibleProbabilidad('87 % de llegar sin tocar tu colchón', 'estimación inicial')).toBe(
      `87 % de llegar sin tocar tu colchón. estimación inicial. ${FRASE_MARCA_PROBABILIDAD}`,
    );
    expect(etiquetaAccesibleProbabilidad('87 % de llegar sin tocar tu colchón', null)).toBe(
      `87 % de llegar sin tocar tu colchón. ${FRASE_MARCA_PROBABILIDAD}`,
    );
  });

  it('calculando expone etiqueta y liveRegion para TalkBack', () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const efectivo = p.e.cuentas['efectivo'] as string;
    for (let f: PlainDate = '2026-10-11'; f < '2026-11-25'; f = sumarDias(f, 1)) {
      registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId: efectivo, monto: 3_000, fecha: f });
    }
    p.reloj.fijar('2026-10-31');
    montar(
      p.ctx,
      <ProbabilidadHoy bloques={{ ceder: () => new Promise(() => undefined) }} hora={() => '10:00'} />,
    );
    expect(screen.getByTestId('probabilidad-calculando')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_PROBABILIDAD_CALCULANDO,
    );
    expect(screen.getByTestId('probabilidad-calculando')).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('mensaje de datos insuficientes usa live region', () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const efectivo = p.e.cuentas['efectivo'] as string;
    for (let f: PlainDate = '2026-10-11'; f < '2026-10-24'; f = sumarDias(f, 1)) {
      registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId: efectivo, monto: 3_000, fecha: f });
    }
    p.reloj.fijar('2026-10-24');
    montar(p.ctx, <ProbabilidadHoy hora={() => '10:00'} />);
    expect(screen.getByTestId('probabilidad-mensaje')).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('calculando anuncia una sola vez; con resultado la barra lleva el texto y el visible queda oculto', async () => {
    const p = await conGastoDiario(1_000, '2026-10-27');
    montar(p.ctx, <ProbabilidadHoy hora={() => '10:00'} />);
    const texto = screen.getByTestId('probabilidad-texto').props.children as string;
    expect(screen.getByTestId('probabilidad-barra').props.accessibilityLabel).toBe(
      etiquetaAccesibleProbabilidad(texto, screen.queryByTestId('probabilidad-etiqueta')?.props.children ?? null),
    );
    expect(screen.getByTestId('probabilidad-texto')).toHaveProp('importantForAccessibility', 'no');
  });
});

describe('aviso de riesgo en Hoy (P < 50 %, 02 §13)', () => {
  it('muestra el aviso y deja programada la notificación del siguiente inicio de día', async () => {
    const p = await conGastoDiario(40_000, '2026-10-27');
    const n = montar(p.ctx, <ProbabilidadHoy hora={() => '10:00'} />);
    expect(screen.getByTestId('aviso-riesgo')).toHaveTextContent(TEXTO_RIESGO);
    expect(screen.getByTestId('aviso-riesgo-texto')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId('aviso-riesgo-texto')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('aviso-riesgo-texto')).toHaveProp('importantForAccessibility', 'yes');
    expect(screen.getByTestId('aviso-riesgo-texto').props.accessibilityLabel).toBe(
      etiquetaAvisoRiesgo(TEXTO_RIESGO),
    );
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

  it('Ajustes → Avisos: pistas TalkBack en permitir y guardar horario', async () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, <SeccionAvisos />, notificacionesEnMemoria('sin_preguntar'));
    await screen.findByTestId('ajustes-avisos-permitir');
    expect(screen.getByTestId('ajustes-avisos-permitir')).toHaveProp('accessibilityHint', PISTA_PERMITIR_AVISOS);
    expect(screen.getByTestId('ajustes-guardar-horario')).toHaveProp('accessibilityHint', PISTA_GUARDAR_HORARIO);
    expect(screen.getByTestId('ajustes-avisos-horario-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(ETIQUETA_HORARIO_SILENCIOSO)).toBeTruthy();
  });

  it('Ajustes → Avisos apaga "Riesgo de no llegar"', async () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, <SeccionAvisos />);
    expect(screen.getByTestId('ajustes-avisos-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(SECCION_AVISOS)).toBeTruthy();
    await screen.findByTestId('ajustes-aviso-riesgo');
    expect(obtenerPreferenciasAvisos(p.ctx).riesgo).toBe(true);
    fireEvent.press(screen.getByTestId('ajustes-aviso-riesgo'));
    expect(obtenerPreferenciasAvisos(p.ctx).riesgo).toBe(false);
  });
});
