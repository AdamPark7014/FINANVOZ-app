import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { navegacionSuperior } from '../ui';
import LayoutPestanas, { ETIQUETA_ACCESIBILIDAD_PESTANA } from '../../app/(tabs)/_layout';
import {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_ACCESIBILIDAD_TU,
  ETIQUETA_PESTANA,
  ROL_ACCESIBILIDAD_BOTON_PESTANA,
  RUTAS_SEGMENTOS,
  TEST_ID_CIRCULO_TU,
  TEST_ID_PANTALLA_REGISTRAR,
  TEXTO_CIRCULO_TU,
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

describe('LayoutPestanas (dirección B, 02 §2)', () => {
  it('el selector de arriba son las tres secciones de los tokens, con testID y etiquetas TalkBack', () => {
    expect(navegacionSuperior.segmentos.map((s) => s.ruta)).toEqual([...RUTAS_SEGMENTOS]);
    for (const { ruta, etiqueta } of navegacionSuperior.segmentos) {
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(ETIQUETA_PESTANA[ruta]).toBe(etiqueta);
      expect(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]).toMatch(/^Pestaña /);
      expect(ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta]).not.toMatch(/^Pestaña /);
    }
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(ROL_ACCESIBILIDAD_BOTON_PESTANA).toBe('tab');
  });

  it('arriba: Asistente · Movimientos · Cuentas como pestañas elegibles y el círculo de Tú; abajo, nada', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    expect(screen.getByTestId('navegacion-superior')).toBeTruthy();
    for (const ruta of RUTAS_SEGMENTOS) {
      const segmento = screen.getByTestId(`pestana-${ruta}`);
      expect(segmento.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]);
      expect(segmento.props.accessibilityRole).toBe('tab');
      expect(screen.getByText(ETIQUETA_PESTANA[ruta])).toBeTruthy();
    }
    expect(screen.getByTestId('pestana-hoy').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('pestana-cuentas').props.accessibilityState).toMatchObject({ selected: false });
    // Tú no es segmento: lo abre el círculo (`boton-ajustes` para Maestro).
    expect(screen.queryByTestId('pestana-tu')).toBeNull();
    const tu = screen.getByTestId(TEST_ID_CIRCULO_TU);
    expect(tu.props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_TU);
    expect(screen.getByText(TEXTO_CIRCULO_TU)).toBeTruthy();
    // `/registrar` es la hoja modal R2, fuera del grupo de pestañas: no tiene botón.
    expect(screen.queryByTestId('pestana-registrar')).toBeNull();
  });

  it('cada segmento lleva a su pantalla y el círculo abre Tú con el selector arriba', () => {
    renderRouter(RUTAS, { initialUrl: '/hoy' });
    fireEvent.press(screen.getByTestId('pestana-movimientos'));
    expect(screen.getByTestId('pantalla-movimientos')).toBeTruthy();
    expect(screen.getByTestId('pestana-movimientos').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByTestId('pestana-cuentas'));
    expect(screen.getByTestId('pantalla-cuentas')).toBeTruthy();
    fireEvent.press(screen.getByTestId(TEST_ID_CIRCULO_TU));
    expect(screen.getByTestId('pantalla-tu')).toBeTruthy();
    expect(screen.getByTestId(TEST_ID_CIRCULO_TU).props.accessibilityState).toMatchObject({ selected: true });
    for (const ruta of RUTAS_SEGMENTOS) {
      expect(screen.getByTestId(`pestana-${ruta}`).props.accessibilityState).toMatchObject({
        selected: false,
      });
    }
    fireEvent.press(screen.getByTestId('pestana-hoy'));
    expect(screen.getByTestId('pantalla-hoy')).toBeTruthy();
  });
});
