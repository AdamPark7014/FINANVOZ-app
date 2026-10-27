import { readdirSync } from 'fs';
import { join } from 'path';
import { navegacionSuperior } from '../ui';
import {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_PESTANA,
  propsContenedorPestana,
  propsContenedorRegistrar,
  ROL_ACCESIBILIDAD_BOTON_PESTANA,
  RUTAS_PESTANAS,
  RUTAS_SEGMENTOS,
  TEST_ID_PANTALLA_PESTANA,
  TEST_ID_PANTALLA_REGISTRAR,
  testIdBotonPestana,
} from './pestanas-textos';

describe('pestanas-textos', () => {
  it('alinea las rutas con la navegación de arriba (selector y Tú), los botones y los contenedores', () => {
    const rutasUi = [...navegacionSuperior.segmentos.map((s) => s.ruta), navegacionSuperior.tu.ruta];
    expect(rutasUi).toEqual([...RUTAS_PESTANAS]);
    expect(navegacionSuperior.segmentos.map((s) => s.ruta)).toEqual([...RUTAS_SEGMENTOS]);
    expect(Object.keys(ETIQUETA_ACCESIBILIDAD_PESTANA).sort()).toEqual([...rutasUi].sort());
    for (const { ruta, etiqueta } of [...navegacionSuperior.segmentos, navegacionSuperior.tu]) {
      expect(ETIQUETA_PESTANA[ruta]).toBe(etiqueta);
      expect(TEST_ID_PANTALLA_PESTANA[ruta]).toBe(`tab-${ruta}`);
      expect(testIdBotonPestana(ruta)).toBe(`pestana-${ruta}`);
      expect(ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]).toMatch(/^Pestaña /);
      expect(ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta]).not.toMatch(/^Pestaña /);
      expect(propsContenedorPestana(ruta)).toEqual({
        testID: TEST_ID_PANTALLA_PESTANA[ruta],
        accessibilityLabel: ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta],
      });
    }
    expect(ROL_ACCESIBILIDAD_BOTON_PESTANA).toBe('tab');
  });

  it('expone contenedor Registrar sin pestaña en la barra', () => {
    expect(TEST_ID_PANTALLA_REGISTRAR).toBe('tab-registrar');
    expect(propsContenedorRegistrar().testID).toBe(TEST_ID_PANTALLA_REGISTRAR);
  });

  it('en `app/(tabs)` solo hay rutas: el layout y una pantalla por pestaña (los textos viven en `src/rutas`)', () => {
    const archivos = readdirSync(join(__dirname, '../../app/(tabs)')).sort();
    expect(archivos).toEqual(['_layout.tsx', ...RUTAS_PESTANAS.map((r) => `${r}.tsx`)].sort());
  });
});
