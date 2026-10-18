import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { barraPestanas } from '../../src/ui';
import LayoutPestanas, { ETIQUETA_ACCESIBILIDAD_PESTANA } from './_layout';

const RUTAS = {
  '(tabs)/_layout': LayoutPestanas,
  '(tabs)/hoy': () => <Text testID="pantalla-hoy">Hoy</Text>,
  '(tabs)/movimientos': () => <Text testID="pantalla-movimientos">Movimientos</Text>,
  '(tabs)/cuentas': () => <Text testID="pantalla-cuentas">Cuentas</Text>,
  '(tabs)/registrar': () => <Text testID="pantalla-registrar">Registrar</Text>,
};

describe('LayoutPestanas', () => {
  it('expone tres pestañas con testID y etiquetas TalkBack (02 §15)', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    for (const { ruta, etiqueta } of barraPestanas.pestanas) {
      const boton = screen.getByTestId(`pestana-${ruta}`);
      expect(boton).toBeTruthy();
      expect(boton.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]);
      expect(screen.getByText(etiqueta)).toBeTruthy();
    }
  });
});
