import { renderRouter, screen, within } from 'expo-router/testing-library';
import { StyleSheet, Text } from 'react-native';
import LayoutPestanas from '../../app/(tabs)/_layout';
import { colores } from '../ui';
import { ETIQUETA_SELECTOR_SECCIONES, TEST_ID_CIRCULO_TU } from './pestanas-textos';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const RUTAS = {
  '(tabs)/_layout': LayoutPestanas,
  '(tabs)/hoy': () => <Text testID="pantalla-hoy">Resumen del día</Text>,
  '(tabs)/movimientos': () => <Text testID="pantalla-movimientos">Lista de movimientos</Text>,
  '(tabs)/cuentas': () => <Text testID="pantalla-cuentas">Tus cuentas</Text>,
  '(tabs)/tu': () => <Text testID="pantalla-tu">Ajustes</Text>,
};

const estilo = (elemento: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(elemento.props.style as never) ?? {}) as Record<string, unknown>;

describe('Navegación de arriba en oscuro (premium)', () => {
  it('la elegida en letra clara y la demás en secundaria, sin halo; el círculo de Tú con su filo', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    const o = colores.oscuro;
    expect(estilo(screen.getByTestId('navegacion-superior')).backgroundColor).toBe(o.fondo);
    expect(screen.getByLabelText(ETIQUETA_SELECTOR_SECCIONES)).toBeTruthy();
    const elegido = estilo(screen.getByTestId('pestana-hoy'));
    // En oscuro una sombra con la letra clara sería un halo: la elegida no la lleva.
    expect(elegido.shadowOpacity).toBeUndefined();
    expect(estilo(within(screen.getByTestId('pestana-hoy')).getByText('Asistente')).color).toBe(o.texto);
    expect(estilo(within(screen.getByTestId('pestana-movimientos')).getByText('Movimientos')).color).toBe(
      o.textoSecundario,
    );
    expect(estilo(screen.getByTestId(TEST_ID_CIRCULO_TU))).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: o.borde,
    });
  });
});
