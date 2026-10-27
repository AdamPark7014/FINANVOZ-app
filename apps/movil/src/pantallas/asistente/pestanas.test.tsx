import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import LayoutPestanas from '../../../app/(tabs)/_layout';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_ACCESIBILIDAD_TU,
  ETIQUETA_PESTANA,
  RUTAS_PESTANAS,
  RUTAS_SEGMENTOS,
  TEST_ID_CIRCULO_TU,
} from '../../rutas/pestanas-textos';

const RUTAS = {
  '(tabs)/_layout': LayoutPestanas,
  '(tabs)/hoy': () => <Text testID="pantalla-hoy">Asistente</Text>,
  '(tabs)/movimientos': () => <Text testID="pantalla-movimientos">Movimientos</Text>,
  '(tabs)/cuentas': () => <Text testID="pantalla-cuentas">Cuentas</Text>,
  '(tabs)/tu': () => <Text testID="ajustes">Tú</Text>,
  registrar: () => <Text testID="pantalla-registrar">R2</Text>,
  ajustes: () => <Text testID="ajustes-ruta">Ajustes</Text>,
};

describe('Navegación de la dirección B (02 §2; antes, pestañas de la Ola 7)', () => {
  it('arriba, Asistente · Movimientos · Cuentas con etiqueta visible y nombre para el lector, y el círculo de Tú', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    expect(RUTAS_PESTANAS).toEqual(['hoy', 'movimientos', 'cuentas', 'tu']);
    expect(RUTAS_SEGMENTOS).toEqual(['hoy', 'movimientos', 'cuentas']);
    for (const ruta of RUTAS_SEGMENTOS) {
      const boton = screen.getByTestId(`pestana-${ruta}`);
      expect(boton.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]);
      expect(screen.getAllByText(ETIQUETA_PESTANA[ruta]).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId(TEST_ID_CIRCULO_TU).props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_TU);
    expect(ETIQUETA_PESTANA.hoy).toBe('Asistente');
    expect(ETIQUETA_PESTANA.tu).toBe('Tú');
  });

  it('no hay pestaña Registrar ni botones sueltos', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    expect(screen.queryByTestId('pestana-registrar')).toBeNull();
    expect(screen.queryByText('registrar')).toBeNull();
    expect(screen.queryByText('hoy-textos')).toBeNull();
    expect(screen.queryByText('pestanas-textos')).toBeNull();
  });

  it('`/registrar` y `/ajustes` siguen abriendo su pantalla; Tú monta Ajustes', () => {
    renderRouter(RUTAS, { initialUrl: '/registrar' });
    expect(screen.getByTestId('pantalla-registrar')).toBeTruthy();
    renderRouter(RUTAS, { initialUrl: '/ajustes' });
    expect(screen.getByTestId('ajustes-ruta')).toBeTruthy();
    renderRouter(RUTAS, { initialUrl: '/tu' });
    expect(screen.getByTestId('ajustes')).toBeTruthy();
  });
});
