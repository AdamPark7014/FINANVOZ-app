import type { ViewProps } from 'react-native';

/**
 * Copy es-MX, testID y TalkBack/VoiceOver de la navegación del grupo `(tabs)` (dirección B, 02-UX §2, §15): arriba,
 * el selector Asistente · Movimientos · Cuentas y el círculo de Tú. La ruta del asistente sigue siendo `hoy` (enlaces,
 * widget, Maestro). Vive fuera de `app/` a propósito: Expo Router vuelve ruta cada archivo de `app/`.
 */

/** Rutas del grupo de pestañas, en orden: las tres del selector y Tú (la abre el círculo). */
export const RUTAS_PESTANAS = ['hoy', 'movimientos', 'cuentas', 'tu'] as const;

export type RutaPestanaVisible = (typeof RUTAS_PESTANAS)[number];

/** Las tres del selector de arriba. */
export const RUTAS_SEGMENTOS = [
  'hoy',
  'movimientos',
  'cuentas',
] as const satisfies readonly RutaPestanaVisible[];

export type RutaSegmento = (typeof RUTAS_SEGMENTOS)[number];

/** El círculo de Tú: lo que se ve dentro (la app no pide tu nombre, así que no hay inicial) y su testID de Maestro. */
export const TEXTO_CIRCULO_TU = 'Tú';
export const TEST_ID_CIRCULO_TU = 'boton-ajustes';
export const ETIQUETA_ACCESIBILIDAD_TU = 'Tú: tu ingreso, la app y tu privacidad';
export const PISTA_CIRCULO_TU = 'Abre tus ajustes';
/** Selector de arriba para el lector. */
export const ETIQUETA_SELECTOR_SECCIONES = 'Secciones';

/** Etiqueta visible de cada pestaña (siempre visible: la activa no se distingue solo por color). */
export const ETIQUETA_PESTANA: Record<RutaPestanaVisible, string> = {
  hoy: 'Asistente',
  movimientos: 'Movimientos',
  cuentas: 'Cuentas',
  tu: 'Tú',
};

export const ETIQUETA_ACCESIBILIDAD_PESTANA = {
  hoy: 'Pestaña Asistente, tu día y lo que me dices',
  movimientos: 'Pestaña Movimientos, historial de movimientos',
  cuentas: 'Pestaña Cuentas, efectivo, tarjetas y deudas',
  tu: 'Pestaña Tú, tu ingreso, tu colchón y ajustes',
} as const satisfies Record<RutaPestanaVisible, string>;

/** Contenedor de la ruta activa: mismo contexto que la pestaña, sin prefijo "Pestaña" (TalkBack §15). */
export const ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA = {
  hoy: 'Asistente, tu día y lo que me dices',
  movimientos: 'Movimientos, historial de movimientos',
  cuentas: 'Cuentas, efectivo, tarjetas y deudas',
  tu: 'Tú, tu ingreso, tu colchón y ajustes',
} as const satisfies Record<RutaPestanaVisible, string>;

/** Rol TalkBack de cada segmento del selector (no confundir con el contenedor de la pantalla). */
export const ROL_ACCESIBILIDAD_BOTON_PESTANA = 'tab' as const;

/** Segmentos del selector (Maestro: `pestana-hoy`, `pestana-movimientos`, `pestana-cuentas`). */
export function testIdBotonPestana(ruta: RutaPestanaVisible): `pestana-${RutaPestanaVisible}` {
  return `pestana-${ruta}`;
}

/** Contenedor de cada pantalla de pestaña (Maestro / pruebas de ruta). */
export const TEST_ID_PANTALLA_PESTANA = {
  hoy: 'tab-hoy',
  movimientos: 'tab-movimientos',
  cuentas: 'tab-cuentas',
  tu: 'tab-tu',
} as const satisfies Record<RutaPestanaVisible, string>;

/**
 * Registrar dejó de ser ruta de pestaña (Ola 7): `/registrar` es la hoja modal R2. Se conservan el testID y las
 * props del contenedor para quien todavía los importa.
 */
export const TEST_ID_PANTALLA_REGISTRAR = 'tab-registrar';

export const ETIQUETA_ACCESIBILIDAD_REGISTRAR = 'Registrar gasto o ingreso';

/** Props de accesibilidad del `View` raíz de cada ruta de pestaña (contenido, no el botón de barra). */
export function propsContenedorPestana(
  ruta: RutaPestanaVisible,
): Pick<ViewProps, 'testID' | 'accessibilityLabel'> {
  return {
    testID: TEST_ID_PANTALLA_PESTANA[ruta],
    accessibilityLabel: ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA[ruta],
  };
}

export function propsContenedorRegistrar(): Pick<ViewProps, 'testID' | 'accessibilityLabel'> {
  return {
    testID: TEST_ID_PANTALLA_REGISTRAR,
    accessibilityLabel: ETIQUETA_ACCESIBILIDAD_REGISTRAR,
  };
}
