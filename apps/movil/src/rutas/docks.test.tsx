import { fireEvent, screen, within } from '@testing-library/react-native';
import { aceptarConsentimiento, agregarCuenta } from '../servicios';
import { renderConSesion } from '../pantallas/principal/__pruebas__/arnes';
import { abrirPruebaPantalla, conEscenario } from '../pantallas/principal/__pruebas__/base';
import { reiniciarR2, tomarPedidoAsistente } from '../pantallas/asistente/r2';
import { TEXTO_BUSQUEDA_VACIA } from '../pantallas/principal/textos';
import { auditar } from '../pantallas/__pruebas__/accesibilidad';
import Cuentas from '../../app/(tabs)/cuentas';
import Movimientos from '../../app/(tabs)/movimientos';

// `mock` al inicio: jest permite que la fábrica de `jest.mock` lo use.
const mockRouter = { navigate: jest.fn(), push: jest.fn(), setParams: jest.fn() };
const router = mockRouter;

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

beforeEach(() => {
  router.navigate.mockClear();
  router.push.mockClear();
  reiniciarR2();
});

/** Dock de voz de Movimientos y Cuentas (dirección B, `02 §2`). */
describe('dock de voz fuera del asistente', () => {
  it('Movimientos: «Buscar» abre el campo y filtra; «Escribir» y el micrófono llevan al asistente', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    renderConSesion(p.ctx, <Movimientos />);
    const dock = screen.getByTestId('dock-movimientos');
    expect(within(dock).getByTestId('boton-buscar').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.queryByTestId('campo-buscar-movimientos')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-buscar'));
    expect(screen.getByTestId('boton-buscar').props.accessibilityState).toMatchObject({ expanded: true });
    fireEvent.changeText(screen.getByTestId('campo-buscar-movimientos'), 'zapatos');
    expect(screen.getByText(TEXTO_BUSQUEDA_VACIA)).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton-buscar'));
    expect(screen.queryByTestId('campo-buscar-movimientos')).toBeNull();

    fireEvent.press(screen.getByTestId('dock-movimientos-escribir'));
    expect(router.navigate).toHaveBeenLastCalledWith('/hoy');
    expect(tomarPedidoAsistente()).toEqual({ tipo: 'escribir' });
    fireEvent(screen.getByTestId('dock-movimientos-hablar'), 'pressOut');
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(tomarPedidoAsistente()).toEqual({ tipo: 'dictar' });
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('Cuentas: «Agregar» abre el menú con cuenta, tarjeta y pago fijo; elegir uno lo cierra y abre su formulario', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <Cuentas />);
    expect(screen.queryByTestId('menu-agregar')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-agregar'));
    const menu = screen.getByTestId('menu-agregar');
    expect(within(menu).getByTestId('boton-agregar-cuenta')).toBeTruthy();
    expect(within(menu).getByTestId('boton-agregar-pago-fijo')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(within(menu).getByTestId('boton-agregar-tarjeta'));
    expect(router.push).toHaveBeenCalledWith('/tarjetas/nueva');
    expect(screen.queryByTestId('menu-agregar')).toBeNull();
    // El mismo botón también lo cierra.
    fireEvent.press(screen.getByTestId('boton-agregar'));
    fireEvent.press(screen.getByTestId('boton-agregar'));
    expect(screen.queryByTestId('menu-agregar')).toBeNull();
    // Ajustes ya no vive aquí: lo abre el círculo de Tú de arriba.
    expect(screen.queryByTestId('boton-ajustes')).toBeNull();
    p.cerrar();
  });
});
