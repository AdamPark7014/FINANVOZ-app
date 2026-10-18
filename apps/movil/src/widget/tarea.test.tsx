import type * as React from 'react';
import { fijarEstadisticas, fijarOcultarMontosWidget } from '../servicios';
import type { Sesion } from '../servicios/sesion';
import { tomarEventosWidget } from '../servicios/widget';
import { conEscenario } from '../pantallas/principal/__pruebas__/base';
import { manejarTareaWidget } from './tarea';

// La base nativa no existe en jest: la tarea recibe cómo abrirla.
jest.mock('../servicios/sesion', () => ({ abrirSesion: jest.fn() }));

interface Arbol {
  type: string;
  props: Record<string, unknown>;
  children?: Arbol[];
}
const { buildWidgetTree } = jest.requireActual<{ buildWidgetTree: (e: React.JSX.Element) => Arbol }>(
  'react-native-android-widget/lib/commonjs/api/build-widget-tree',
);
const textos = (a: Arbol): string[] => [
  ...(a.type === 'TextWidget' ? [String(a.props.text)] : []),
  ...(a.children ?? []).flatMap(textos),
];
type Pintado = { light: React.JSX.Element; dark: React.JSX.Element };
const pintado = (f: jest.Mock, i = 0): Pintado => (f.mock.calls[i] as [Pintado])[0];

function sesionE401() {
  const p = conEscenario('e4-01');
  const cerrar = jest.fn(p.cerrar);
  const abrir = (): Sesion => ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar } }) as unknown as Sesion;
  return { p, cerrar, abrir };
}

describe('tarea del widget en segundo plano', () => {
  it('al agregarlo, al cambiar su tamaño y cada hora abre la base, pinta "Hoy puedes $214 · 4 días" y la cierra', async () => {
    for (const widgetAction of ['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'] as const) {
      const { abrir, cerrar } = sesionE401();
      const renderWidget = jest.fn();
      await manejarTareaWidget({ widgetAction, renderWidget }, abrir);
      expect(renderWidget).toHaveBeenCalledTimes(1);
      expect(textos(buildWidgetTree(pintado(renderWidget).light)).join(' ')).toBe('Hoy puedes $214 · 4 días');
      expect(textos(buildWidgetTree(pintado(renderWidget).dark)).join(' ')).toBe('Hoy puedes $214 · 4 días');
      expect(cerrar).toHaveBeenCalledTimes(1);
    }
  });

  it('con "Ocultar montos" o sin poder abrir la base pinta "Toca para ver tu día"', async () => {
    const { p, abrir } = sesionE401();
    fijarOcultarMontosWidget(p.ctx, true);
    const renderWidget = jest.fn();
    await manejarTareaWidget({ widgetAction: 'WIDGET_UPDATE', renderWidget }, abrir);
    expect(textos(buildWidgetTree(pintado(renderWidget).light))).toEqual(['Toca para ver tu día']);
    p.cerrar();

    const fallida = jest.fn();
    await manejarTareaWidget({ widgetAction: 'WIDGET_UPDATE', renderWidget: fallida }, () => {
      throw new Error('sin llave');
    });
    expect(textos(buildWidgetTree(pintado(fallida).dark))).toEqual(['Toca para ver tu día']);
  });

  it('al tocarlo no pinta ni abre la base', async () => {
    const abrir = jest.fn();
    const renderWidget = jest.fn();
    await manejarTareaWidget({ widgetAction: 'WIDGET_CLICK', renderWidget }, abrir);
    expect(abrir).not.toHaveBeenCalled();
    expect(renderWidget).not.toHaveBeenCalled();
  });

  it('pendiente 79 · agregarlo y quitarlo quedan pendientes para la analítica (con el opt-in), sin pintar al quitarlo', async () => {
    // La misma base en las cuatro corridas: aquí cerrar no la cierra de verdad.
    const p = conEscenario('e4-01');
    const cerrar = jest.fn();
    const abrir = (): Sesion => ({ ctx: p.ctx, base: { db: p.ctx.db, cerrar } }) as unknown as Sesion;
    fijarEstadisticas(p.ctx, true);
    const renderWidget = jest.fn();
    await manejarTareaWidget({ widgetAction: 'WIDGET_ADDED', renderWidget }, abrir);
    await manejarTareaWidget({ widgetAction: 'WIDGET_UPDATE', renderWidget }, abrir);
    await manejarTareaWidget({ widgetAction: 'WIDGET_DELETED', renderWidget }, abrir);
    expect(renderWidget).toHaveBeenCalledTimes(2);
    expect(cerrar).toHaveBeenCalledTimes(3);
    expect(tomarEventosWidget(p.ctx)).toEqual(['agregado', 'quitado']);

    // Sin el opt-in no se anota nada; sin base, quitarlo no truena.
    fijarEstadisticas(p.ctx, false);
    await manejarTareaWidget({ widgetAction: 'WIDGET_DELETED', renderWidget }, abrir);
    expect(tomarEventosWidget(p.ctx)).toEqual([]);
    await expect(
      manejarTareaWidget({ widgetAction: 'WIDGET_DELETED', renderWidget }, () => {
        throw new Error('sin llave');
      }),
    ).resolves.toBeUndefined();
    p.cerrar();
  });
});
