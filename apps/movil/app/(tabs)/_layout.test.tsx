import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { barraPestanas } from '../../src/ui';
import LayoutPestanas, { ETIQUETA_ACCESIBILIDAD_PESTANA } from './_layout';
import {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ROL_ACCESIBILIDAD_BOTON_PESTANA,
  TEST_ID_PANTALLA_REGISTRAR,
  testIdBotonPestana,
} from './pestanas-textos';

const RUTAS = {
  '(tabs)/_layout': LayoutPestanas,
  '(tabs)/hoy': () => <Text testID="pantalla-hoy">Resumen del día</Text>,
  '(tabs)/movimientos': () => <Text testID="pantalla-movimientos">Lista de movimientos</Text>,
  '(tabs)/cuentas': () => <Text testID="pantalla-cuentas">Tus cuentas</Text>,
  '(tabs)/registrar': () => <Text testID="pantalla-registrar">Formulario registrar</Text>,
};

describe('LayoutPestanas', () => {
  it('pestanas-textos alinea botones con barraPestanas', () => {
    for (const { ruta } of barraPestanas.pestanas) {
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]).toMatch(/^Pestaña /);
      expect(ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta]).not.toMatch(/^Pestaña /);
    }
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(ROL_ACCESIBILIDAD_BOTON_PESTANA).toBe('tab');
  });

  it('expone tres pestañas con testID y etiquetas TalkBack (02 §15)', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    for (const { ruta, etiqueta } of barraPestanas.pestanas) {
      const boton = screen.getByTestId(`pestana-${ruta}`);
      expect(boton).toBeTruthy();
      expect(boton.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]);
      expect(boton.props.accessibilityRole).toBe(ROL_ACCESIBILIDAD_BOTON_PESTANA);
      expect(screen.getByText(etiqueta)).toBeTruthy();
    }
  });
});
