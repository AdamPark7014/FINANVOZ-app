import { screen } from '@testing-library/react-native';
import { aceptarConsentimiento, agregarCuenta } from '../../src/servicios';
import { renderConSesion } from '../../src/pantallas/principal/__pruebas__/arnes';
import { abrirPruebaPantalla } from '../../src/pantallas/principal/__pruebas__/base';
import Hoy from './hoy';
import { ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA } from './pestanas-textos';
import {
  PISTA_CONFIGURAR_INGRESO_HOY,
  SUBTITULO_SIN_INGRESO,
  TEST_ID_HOY_SIN_INGRESO,
  TEST_ID_TAB_HOY,
  TITULO_SIN_INGRESO,
} from './hoy-textos';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: jest.fn(),
    push: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
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
    expect(screen.getByTestId(TEST_ID_TAB_HOY)).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA.hoy,
    );
    expect(screen.getByTestId('pantalla-hoy')).toBeTruthy();
    expect(screen.getByTestId(TEST_ID_HOY_SIN_INGRESO.contenedor)).toBeTruthy();
    expect(screen.getByTestId(TEST_ID_HOY_SIN_INGRESO.titulo)).toHaveTextContent(TITULO_SIN_INGRESO);
    expect(screen.getByTestId(TEST_ID_HOY_SIN_INGRESO.subtitulo)).toHaveTextContent(SUBTITULO_SIN_INGRESO);
    expect(screen.getByTestId(TEST_ID_HOY_SIN_INGRESO.boton)).toHaveProp(
      'accessibilityHint',
      PISTA_CONFIGURAR_INGRESO_HOY,
    );
    p.cerrar();
  });
});
