import type { ViewProps } from 'react-native';

/**
 * Copy es-MX, testID y TalkBack/VoiceOver de la barra y rutas del grupo `(tabs)` (Ola 7 §2, 02-UX §2, §15): cuatro
 * pestañas Asistente · Movimientos · Cuentas · Tú. La ruta del asistente sigue siendo `hoy` (enlaces, widget, Maestro).
 * Vive fuera de `app/` a propósito: Expo Router vuelve ruta cada archivo de `app/`, y un archivo de textos ahí salía
 * como botón suelto en la barra.
 */

/** Rutas con pestaña, en orden. */
export const RUTAS_PESTANAS = ['hoy', 'movimientos', 'cuentas', 'tu'] as const;

export type RutaPestanaVisible = (typeof RUTAS_PESTANAS)[number];

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

/** Rol TalkBack de cada botón en la barra inferior (no confundir con el contenedor de la pantalla). */
export const ROL_ACCESIBILIDAD_BOTON_PESTANA = 'tab' as const;

/** Botones de la barra inferior (Maestro: `pestana-hoy`, `pestana-tu`, etc.). */
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
