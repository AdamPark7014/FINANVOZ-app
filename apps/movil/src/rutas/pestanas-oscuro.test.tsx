import { renderRouter, screen } from 'expo-router/testing-library';
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

describe('Navegación de arriba en oscuro (tablero B6)', () => {
  it('riel y segmento elegido en los verdes casi negros, sin halo; el círculo de Tú sobre la tarjeta con su filo', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    const o = colores.oscuro;
    expect(estilo(screen.getByTestId('navegacion-superior')).backgroundColor).toBe(o.fondo);
    expect(estilo(screen.getByLabelText(ETIQUETA_SELECTOR_SECCIONES)).backgroundColor).toBe(o.segmento);
    const elegido = estilo(screen.getByTestId('pestana-hoy'));
    expect(elegido.backgroundColor).toBe(o.segmentoActivo);
    // En oscuro una sombra con la letra clara sería un halo: el segmento elegido no la lleva.
    expect(elegido.shadowOpacity).toBeUndefined();
    expect(estilo(screen.getByTestId('pestana-movimientos')).backgroundColor).toBe('transparent');
    expect(estilo(screen.getByTestId(TEST_ID_CIRCULO_TU))).toMatchObject({
      backgroundColor: o.superficie,
      borderColor: o.borde,
    });
  });
});
