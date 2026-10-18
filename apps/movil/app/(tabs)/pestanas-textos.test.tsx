import { barraPestanas } from '../../src/ui';
import {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  propsContenedorPestana,
  propsContenedorRegistrar,
  ROL_ACCESIBILIDAD_BOTON_PESTANA,
  TEST_ID_PANTALLA_PESTANA,
  TEST_ID_PANTALLA_REGISTRAR,
  testIdBotonPestana,
} from './pestanas-textos';

describe('pestanas-textos', () => {
  it('alinea rutas visibles con barraPestanas, botones y contenedores', () => {
    const rutasUi = barraPestanas.pestanas.map((p) => p.ruta);
    expect(Object.keys(ETIQUETA_ACCESIBILIDAD_PESTANA).sort()).toEqual([...rutasUi].sort());
    for (const { ruta } of barraPestanas.pestanas) {
      expect(TEST_ID_PANTALLA_PESTANA[ruta]).toBe(`tab-${ruta}`);
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]).toMatch(/^Pestaña /);
      expect(ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta]).not.toMatch(/^Pestaña /);
      expect(propsContenedorPestana(ruta)).toEqual({
        testID: TEST_ID_PANTALLA_PESTANA[ruta],
        accessibilityLabel: ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta],
      });
    }
  });

  it('expone contenedor Registrar sin pestaña en la barra', () => {
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(propsContenedorRegistrar().testID).toBe(TEST_ID_PANTALLA_REGISTRAR);
  });
});
