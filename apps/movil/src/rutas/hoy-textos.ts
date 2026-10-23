/**
 * Copy es-MX de la pestaña Asistente (ruta `hoy`, Ola 7); la cabecera usa los mismos textos que `principal/textos`
 * y el asistente los suyos en `pantallas/asistente/textos`. Fuera de `app/` para que Expo Router no lo vuelva ruta.
 */
export {
  PISTA_CONFIGURAR_INGRESO_HOY,
  SUBTITULO_SIN_INGRESO,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
  TITULO_SIN_INGRESO,
} from '../pantallas/principal/textos';

export {
  ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA,
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_PESTANA,
  TEST_ID_PANTALLA_PESTANA,
} from './pestanas-textos';

import { TEST_ID_PANTALLA_PESTANA } from './pestanas-textos';

/** testID estables para Maestro y pruebas de la ruta del asistente. */
export const TEST_ID_TAB_HOY = TEST_ID_PANTALLA_PESTANA.hoy;

/** Sin ingreso configurado (`02 §4.2`; UI en `pantallas/asistente/CabeceraDia`). */
export const TEST_ID_HOY_SIN_INGRESO = {
  contenedor: 'hoy-sin-ingreso',
  titulo: 'hoy-sin-ingreso-titulo',
  subtitulo: 'hoy-sin-ingreso-subtitulo',
  boton: 'boton-configurar-ingreso',
} as const;

/** testID que Maestro iOS (`.maestro/ios`) usa en la pestaña Asistente (criterio 10 de la Ola 7). */
export const TEST_ID_ASISTENTE = {
  pantalla: 'pantalla-hoy',
  fecha: 'hoy-fecha',
  hablar: 'boton-hablar',
  escribir: 'boton-escribir',
  campo: 'campo-registrar',
  enviar: 'boton-enviar-registro',
  formulario: 'boton-formulario',
  registro: 'aviso',
  desglose: 'boton-desglose',
  hojaDesglose: 'desglose',
  meAlcanza: 'boton-me-alcanza',
  candado: 'candado-probabilidad',
  estadoVacio: 'estado-vacio-mic',
} as const;
