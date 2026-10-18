import { barraPestanas } from '../../src/ui';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  propsContenedorPestana,
  propsContenedorRegistrar,
  TEST_ID_PANTALLA_PESTANA,
  TEST_ID_PANTALLA_REGISTRAR,
  testIdBotonPestana,
} from './pestanas-textos';

describe('pestanas-textos', () => {
  it('alinea rutas visibles con barraPestanas y testID de botón', () => {
    const rutasUi = barraPestanas.pestanas.map((p) => p.ruta);
    const rutasTextos = Object.keys(ETIQUETA_ACCESIBILIDAD_PESTANA);
    expect(rutasTextos.sort()).toEqual([...rutasUi].sort());
    for (const { ruta } of barraPestanas.pestanas) {
      expect(TEST_ID_PANTALLA_PESTANA[ruta]).toBe(`tab-${ruta}`);
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(propsContenedorPestana(ruta)).toEqual({
        testID: TEST_ID_PANTALLA_PESTANA[ruta],
        accessibilityLabel: ETIQUETA_ACCESIBILIDAD_PESTANA[ruta],
      });
    }
  });

  it('expone contenedor Registrar sin pestaña en la barra', () => {
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(propsContenedorRegistrar().testID).toBe(TEST_ID_PANTALLA_REGISTRAR);
  });
});
