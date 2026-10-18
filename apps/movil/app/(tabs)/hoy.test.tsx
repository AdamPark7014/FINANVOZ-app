import { screen } from '@testing-library/react-native';
import { aceptarConsentimiento, agregarCuenta } from '../../src/servicios';
import { crearMotorFalso, renderConSesion } from '../../src/pantallas/principal/__pruebas__/arnes';
import { abrirPruebaPantalla } from '../../src/pantallas/principal/__pruebas__/base';
import Hoy from './hoy';
import { SUBTITULO_SIN_INGRESO, TITULO_SIN_INGRESO, TEST_ID_TAB_HOY } from './hoy-textos';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('../../src/compartido/expo', () => ({
  dependenciasCompartidoExpo: () => ({
    cripto: { generarClave: jest.fn(), cifrar: jest.fn(), descifrar: jest.fn() },
    almacen: { leer: jest.fn(), escribir: jest.fn(), borrar: jest.fn() },
    cliente: { enviar: jest.fn(), recibir: jest.fn() },
  }),
}));

describe('pestaña Hoy (ruta)', () => {
  it('sin ingreso muestra empty state es-MX con testID', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    renderConSesion(p.ctx, <Hoy />);
    expect(screen.getByTestId(TEST_ID_TAB_HOY)).toBeTruthy();
    expect(screen.getByTestId('pantalla-hoy')).toBeTruthy();
    expect(screen.getByTestId('hoy-sin-ingreso-titulo')).toHaveTextContent(TITULO_SIN_INGRESO);
    expect(screen.getByTestId('hoy-sin-ingreso-subtitulo')).toHaveTextContent(SUBTITULO_SIN_INGRESO);
    expect(screen.getByTestId('boton-configurar-ingreso')).toBeTruthy();
    p.cerrar();
  });
});
