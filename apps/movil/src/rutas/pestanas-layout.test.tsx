import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { barraPestanas } from '../ui';
import LayoutPestanas, { ETIQUETA_ACCESIBILIDAD_PESTANA } from '../../app/(tabs)/_layout';
import {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_PESTANA,
  ROL_ACCESIBILIDAD_BOTON_PESTANA,
  RUTAS_PESTANAS,
  TEST_ID_PANTALLA_REGISTRAR,
  testIdBotonPestana,
} from './pestanas-textos';

const RUTAS = {
  '(tabs)/_layout': LayoutPestanas,
  '(tabs)/hoy': () => <Text testID="pantalla-hoy">Resumen del día</Text>,
  '(tabs)/movimientos': () => <Text testID="pantalla-movimientos">Lista de movimientos</Text>,
  '(tabs)/cuentas': () => <Text testID="pantalla-cuentas">Tus cuentas</Text>,
  '(tabs)/tu': () => <Text testID="pantalla-tu">Ajustes</Text>,
  registrar: () => <Text testID="pantalla-registrar">Formulario registrar</Text>,
};

describe('LayoutPestanas', () => {
  it('pestanas-textos alinea botones con barraPestanas', () => {
    expect(barraPestanas.pestanas.map((p) => p.ruta)).toEqual([...RUTAS_PESTANAS]);
    for (const { ruta, etiqueta } of barraPestanas.pestanas) {
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(ETIQUETA_PESTANA[ruta]).toBe(etiqueta);
      expect(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]).toMatch(/^Pestaña /);
      expect(ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta]).not.toMatch(/^Pestaña /);
    }
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(ROL_ACCESIBILIDAD_BOTON_PESTANA).toBe('tab');
  });

  it('expone cuatro pestañas con testID y etiquetas TalkBack (Ola 7 §2, 02 §15)', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    expect(barraPestanas.pestanas).toHaveLength(4);
    for (const { ruta, etiqueta } of barraPestanas.pestanas) {
      const boton = screen.getByTestId(`pestana-${ruta}`);
      expect(boton).toBeTruthy();
      expect(boton.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]);
      expect(screen.getAllByText(etiqueta).length).toBeGreaterThan(0);
    }
    // `/registrar` es la hoja modal R2, fuera del grupo de pestañas: no tiene botón en la barra.
    expect(screen.queryByTestId('pestana-registrar')).toBeNull();
  });
});
