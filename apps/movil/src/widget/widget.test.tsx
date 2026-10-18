import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type * as React from 'react';
import { Pressable, Text } from 'react-native';
import {
  construirVistaWidget,
  fijarBloqueo,
  fijarOcultarMontosWidget,
  obtenerAjustesWidget,
  obtenerVistaWidget,
  registrarTextoLocal,
  type VistaWidget,
} from '../servicios';
import { ProveedorSesion, useSesion } from '../sesion/ProveedorSesion';
import { conEscenario } from '../pantallas/principal/__pruebas__/base';
import { SeccionWidget } from '../pantallas/ajustes/SeccionWidget';
import { auditar } from '../pantallas/__pruebas__/accesibilidad';
import { PISTA_PREVIA } from '../pantallas/ajustes/widget-textos';
import { SincronizarWidget } from './SincronizarWidget';
import { PreviaWidget, VISTA_EJEMPLO_WIDGET } from './PreviaWidget';
import { WidgetHoy } from './WidgetHoy';
import { actualizarWidget } from './actualizar';

const { representacion } = jest.requireActual<typeof import('./actualizar')>('./actualizar');

jest.mock('./actualizar', () => ({ actualizarWidget: jest.fn(async () => {}) }));
const mockActualizar = actualizarWidget as jest.MockedFunction<typeof actualizarWidget>;

/** El árbol que la biblioteca manda al código nativo (con su propia validación), no una copia de ella. */
interface Arbol {
  type: string;
  props: Record<string, unknown>;
  children?: Arbol[];
}
const { buildWidgetTree } = jest.requireActual<{ buildWidgetTree: (e: React.JSX.Element) => Arbol }>(
  'react-native-android-widget/lib/commonjs/api/build-widget-tree',
);

function textos(a: Arbol): string[] {
  const propios = a.type === 'TextWidget' ? [String(a.props.text)] : [];
  return [...propios, ...(a.children ?? []).flatMap(textos)];
}

describe('PreviaWidget (vista previa en Ajustes)', () => {
  it('muestra la misma línea de ejemplo que e4-01', () => {
    render(<PreviaWidget vista={VISTA_EJEMPLO_WIDGET} esquema="claro" />);
    const previa = screen.getByTestId('previa-widget');
    expect(within(previa).getByTestId('previa-widget-titulo', { includeHiddenElements: true }).props.children).toBe(
      'Hoy puedes',
    );
    expect(within(previa).getByTestId('previa-widget-cifra', { includeHiddenElements: true }).props.children).toBe(
      '$214',
    );
    expect(within(previa).getByTestId('previa-widget-detalle', { includeHiddenElements: true }).props.children).toBe(
      '· 4 días',
    );
  });

  it('anuncia una etiqueta hablada y oculta los textos internos para TalkBack', () => {
    render(
      <PreviaWidget
        vista={VISTA_EJEMPLO_WIDGET}
        esquema="claro"
        pistaAccesible={PISTA_PREVIA}
      />,
    );
    const previa = screen.getByTestId('previa-widget');
    expect(previa.props.accessibilityRole).toBe('summary');
    expect(previa.props.accessibilityLabel).toBe('Hoy puedes doscientos catorce pesos · 4 días');
    expect(previa.props.accessibilityHint).toBe(PISTA_PREVIA);
    expect(
      within(previa).getByTestId('previa-widget-fila', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants');
    expect(within(previa).getByText('Hoy puedes', { hidden: true }).props.importantForAccessibility).toBe(
      'no',
    );
  });

  it('modo solo texto oculta el copy interno como la fila con cifra', () => {
    const soloTexto = construirVistaWidget(
      { estado: 'normal', hoyPuedesPesos: 214, dias: 4 },
      { ocultarMontos: true },
    );
    render(<PreviaWidget vista={soloTexto} esquema="claro" pistaAccesible={PISTA_PREVIA} />);
    const previa = screen.getByTestId('previa-widget');
    expect(previa.props.accessibilityLabel).toBe('Toca para ver tu día');
    expect(previa.props.accessibilityHint).toBe(PISTA_PREVIA);
    expect(previa.props.accessibilityLabel).not.toMatch(/\$|\d/);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/\$|214/);
    expect(auditar(screen.toJSON())).toEqual([]);
    expect(
      within(previa).getByTestId('previa-widget-solo-texto', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants');
    expect(
      within(previa).getByTestId('previa-widget-texto', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no');
  });

  it('con cifra pasa auditoría: una sola etiqueta hablada, sin cifras sueltas en el árbol', () => {
    render(<PreviaWidget vista={VISTA_EJEMPLO_WIDGET} esquema="claro" pistaAccesible={PISTA_PREVIA} />);
    expect(auditar(screen.toJSON())).toEqual([]);
    const previa = screen.getByTestId('previa-widget');
    expect(
      within(previa).getByTestId('previa-widget-cifra', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no');
  });
});

describe('WidgetHoy (componente del widget)', () => {
  it('claro y oscuro usan los tokens de cada esquema', () => {
    const v = construirVistaWidget(null, { ocultarMontos: false });
    const { light, dark } = representacion(v);
    expect(buildWidgetTree(light).props.backgroundColor).toBe('#FFFFFF');
    expect(buildWidgetTree(dark).props.backgroundColor).not.toBe('#FFFFFF');
  });

  const cifra = construirVistaWidget(
    { estado: 'normal', hoyPuedesPesos: 214, dias: 4 },
    { ocultarMontos: false },
  );

  it('pinta "Hoy puedes $214 · 4 días" en claro y en oscuro; todo el widget abre Hoy', () => {
    for (const esquema of ['claro', 'oscuro'] as const) {
      const arbol = buildWidgetTree(<WidgetHoy vista={cifra} esquema={esquema} />);
      expect(arbol.type).toBe('LinearLayoutWidget');
      expect(textos(arbol).join(' ')).toBe('Hoy puedes $214 · 4 días');
      expect(arbol.props).toMatchObject({
        clickAction: 'OPEN_URI',
        clickActionData: { uri: 'finanvoz:///' },
        accessibilityLabel: 'Hoy puedes doscientos catorce pesos · 4 días',
      });
    }
  });

  it('"Ocultar montos": solo "Toca para ver tu día", sin cifras ni en la etiqueta accesible', () => {
    const oculto = construirVistaWidget(
      { estado: 'normal', hoyPuedesPesos: 214, dias: 4 },
      { ocultarMontos: true },
    );
    const arbol = buildWidgetTree(<WidgetHoy vista={oculto} esquema="claro" />);
    expect(textos(arbol)).toEqual(['Toca para ver tu día']);
    expect(arbol.props).toMatchObject({ clickAction: 'OPEN_URI', clickActionData: { uri: 'finanvoz:///' } });
    expect(JSON.stringify(arbol)).not.toMatch(/\$|214/);
  });
});

describe('SincronizarWidget', () => {
  beforeEach(() => mockActualizar.mockClear());

  function Registrar() {
    const { ctx, refrescar } = useSesion();
    return (
      <Pressable
        testID="registrar"
        onPress={() => {
          registrarTextoLocal(ctx, 'gasté 200 en tacos');
          refrescar();
        }}
      >
        <Text>Registrar</Text>
      </Pressable>
    );
  }

  function OcultarMontos() {
    const { ctx, refrescar } = useSesion();
    return (
      <Pressable
        testID="ocultar"
        onPress={() => {
          fijarOcultarMontosWidget(ctx, true);
          refrescar();
        }}
      >
        <Text>Ocultar</Text>
      </Pressable>
    );
  }

  const ultima = (): VistaWidget => {
    const llamada = mockActualizar.mock.calls.at(-1);
    if (!llamada) throw new Error('el widget no se actualizó');
    return llamada[0];
  };

  it('CA-M10-05 · con e4-01 manda "Hoy puedes $214 · 4 días" y se actualiza al registrar y al ocultar montos', async () => {
    const p = conEscenario('e4-01');
    render(
      <ProveedorSesion ctx={p.ctx}>
        <SincronizarWidget />
        <Registrar />
        <OcultarMontos />
      </ProveedorSesion>,
    );
    await act(async () => {});
    expect(ultima().texto).toBe('Hoy puedes $214 · 4 días');
    expect(mockActualizar).toHaveBeenCalledTimes(1);

    // Registrar con la app abierta actualiza el widget en el mismo ciclo de render (≤ 5 s: sin esperar nada).
    fireEvent.press(screen.getByTestId('registrar'));
    await act(async () => {});
    expect(mockActualizar).toHaveBeenCalledTimes(2);
    expect(ultima()).toEqual(obtenerVistaWidget(p.ctx));
    expect(ultima().texto).not.toBe('Hoy puedes $214 · 4 días');
    expect(ultima().texto).toMatch(/^Hoy puedes \$\d+ · 4 días$/);

    fireEvent.press(screen.getByTestId('ocultar'));
    await act(async () => {});
    expect(ultima().texto).toBe('Toca para ver tu día');
    p.cerrar();
  });

  it('no vuelve a pintar si la vista no cambió (otra escritura que no mueve la cifra)', async () => {
    const p = conEscenario('e4-01');
    let refrescar: () => void = () => {};
    function Capturar() {
      refrescar = useSesion().refrescar;
      return null;
    }
    render(
      <ProveedorSesion ctx={p.ctx}>
        <SincronizarWidget />
        <Capturar />
      </ProveedorSesion>,
    );
    await act(async () => {});
    await act(async () => refrescar());
    expect(mockActualizar).toHaveBeenCalledTimes(1);
    p.cerrar();
  });
});

describe('Ajustes → Widget', () => {
  beforeEach(() => mockActualizar.mockClear());

  it('"Ocultar montos" se enciende y se apaga, y el widget cambia en el momento', async () => {
    const p = conEscenario('e4-01');
    render(
      <ProveedorSesion ctx={p.ctx}>
        <SincronizarWidget />
        <SeccionWidget />
      </ProveedorSesion>,
    );
    await act(async () => {});
    const interruptor = screen.getByTestId('ajustes-widget-ocultar');
    expect(interruptor.props.accessibilityState).toMatchObject({ checked: false });

    fireEvent.press(interruptor);
    await act(async () => {});
    expect(obtenerAjustesWidget(p.ctx)).toEqual({ ocultarMontos: true });
    expect(
      within(screen.getByTestId('ajustes-widget-previa')).getByTestId('previa-widget').props.accessibilityLabel,
    ).not.toMatch(/\$|\d/);
    expect(auditar(screen.toJSON())).toEqual([]);
    expect(screen.getByTestId('ajustes-widget-ocultar').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(mockActualizar.mock.calls.at(-1)?.[0].texto).toBe('Toca para ver tu día');

    fireEvent.press(screen.getByTestId('ajustes-widget-ocultar'));
    await act(async () => {});
    expect(mockActualizar.mock.calls.at(-1)?.[0].texto).toBe('Hoy puedes $214 · 4 días');
    p.cerrar();
  });

  it('con el bloqueo biométrico activo aparece encendido por omisión', () => {
    const p = conEscenario('e4-01');
    fijarBloqueo(p.ctx, { activo: true });
    render(
      <ProveedorSesion ctx={p.ctx}>
        <SeccionWidget />
      </ProveedorSesion>,
    );
    expect(screen.getByTestId('ajustes-widget-ocultar').props.accessibilityState).toMatchObject({
      checked: true,
    });
    p.cerrar();
  });
});
