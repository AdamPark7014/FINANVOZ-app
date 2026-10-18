import type { ViewProps } from 'react-native';

/** Copy es-MX, testID y TalkBack de la barra y rutas del grupo `(tabs)` (02-UX §2, §15). */

export const ETIQUETA_ACCESIBILIDAD_PESTANA = {
  hoy: 'Pestaña Hoy, resumen de tu día',
  movimientos: 'Pestaña Movimientos, historial de movimientos',
  cuentas: 'Pestaña Cuentas, efectivo, tarjetas y deudas',
} as const;

/** Contenedor de la ruta activa: mismo contexto que la pestaña, sin prefijo "Pestaña" (TalkBack §15). */
export const ETIQUETA_ACCESIBILIDAD_CONTENIDO_PESTANA = {
  hoy: 'Hoy, resumen de tu día',
  movimientos: 'Movimientos, historial de movimientos',
  cuentas: 'Cuentas, efectivo, tarjetas y deudas',
} as const satisfies Record<keyof typeof ETIQUETA_ACCESIBILIDAD_PESTANA, string>;

export type RutaPestanaVisible = keyof typeof ETIQUETA_ACCESIBILIDAD_PESTANA;

/** Rol TalkBack de cada botón en la barra inferior (no confundir con el contenedor de la pantalla). */
export const ROL_ACCESIBILIDAD_BOTON_PESTANA = 'tab' as const;

/** Botones de la barra inferior (Maestro: `pestana-hoy`, etc.). */
export function testIdBotonPestana(ruta: RutaPestanaVisible): `pestana-${RutaPestanaVisible}` {
  return `pestana-${ruta}`;
}

/** Contenedor de cada pantalla de pestaña (Maestro / pruebas de ruta). */
export const TEST_ID_PANTALLA_PESTANA = {
  hoy: 'tab-hoy',
  movimientos: 'tab-movimientos',
  cuentas: 'tab-cuentas',
} as const;

export const TEST_ID_PANTALLA_REGISTRAR = 'tab-registrar';

export const ETIQUETA_ACCESIBILIDAD_REGISTRAR = 'Registrar gasto o ingreso';

/** Props de accesibilidad del `View` raíz de cada ruta de pestaña (misma etiqueta que el botón activo). */
export function propsContenedorPestana(
  ruta: RutaPestanaVisible,
): Pick<ViewProps, 'testID' | 'accessibilityLabel'> {
  return {
    testID: TEST_ID_PANTALLA_PESTANA[ruta],
    accessibilityLabel: ETIQUETA_ACCESIBILIDAD_PESTANA[ruta],
  };
}

export function propsContenedorRegistrar(): Pick<ViewProps, 'testID' | 'accessibilityLabel'> {
  return {
    testID: TEST_ID_PANTALLA_REGISTRAR,
    accessibilityLabel: ETIQUETA_ACCESIBILIDAD_REGISTRAR,
  };
}
