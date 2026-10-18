/** Copy es-MX, testID y TalkBack de la barra y rutas del grupo `(tabs)` (02-UX §2, §15). */

export const ETIQUETA_ACCESIBILIDAD_PESTANA = {
  hoy: 'Pestaña Hoy, resumen de tu día',
  movimientos: 'Pestaña Movimientos, historial de movimientos',
  cuentas: 'Pestaña Cuentas, efectivo, tarjetas y deudas',
} as const;

export type RutaPestanaVisible = keyof typeof ETIQUETA_ACCESIBILIDAD_PESTANA;

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
