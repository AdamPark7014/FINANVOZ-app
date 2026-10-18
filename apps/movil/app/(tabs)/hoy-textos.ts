/** Copy es-MX de la pestaña Hoy (ruta); el héroe usa los mismos textos que `principal/textos`. */
export {
  PISTA_CONFIGURAR_INGRESO_HOY,
  SUBTITULO_SIN_INGRESO,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
  TITULO_SIN_INGRESO,
} from '../../src/pantallas/principal/textos';

export {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  TEST_ID_PANTALLA_PESTANA,
} from './pestanas-textos';

import { TEST_ID_PANTALLA_PESTANA } from './pestanas-textos';

/** testID estables para Maestro y pruebas de la ruta Hoy. */
export const TEST_ID_TAB_HOY = TEST_ID_PANTALLA_PESTANA.hoy;

/** Empty state sin ingreso configurado (`02 §4.2`; UI en `PantallaHoy`). */
export const TEST_ID_HOY_SIN_INGRESO = {
  contenedor: 'hoy-sin-ingreso',
  titulo: 'hoy-sin-ingreso-titulo',
  subtitulo: 'hoy-sin-ingreso-subtitulo',
  boton: 'boton-configurar-ingreso',
} as const;
