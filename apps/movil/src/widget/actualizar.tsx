import { Platform } from 'react-native';
import type { VistaWidget } from '../servicios';
import { NOMBRE_WIDGET, WidgetHoy } from './WidgetHoy';

type ModuloWidget = typeof import('react-native-android-widget');

/** El módulo nativo se carga al usarse: sin él (iPhone, pruebas, una build sin el plugin) no pasa nada. */
export function moduloWidget(): ModuloWidget | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa del módulo nativo
    return require('react-native-android-widget') as ModuloWidget;
  } catch {
    return null;
  }
}

/** Las dos variantes (claro y oscuro); el lanzador elige según el tema del teléfono. */
export function representacion(vista: VistaWidget) {
  return {
    light: <WidgetHoy vista={vista} esquema="claro" />,
    dark: <WidgetHoy vista={vista} esquema="oscuro" />,
  };
}

/**
 * Vuelve a pintar cada widget "Hoy puedes" que esté en la pantalla de inicio con `vista`. Sin widgets agregados
 * no hace nada. Nunca lanza: el widget es secundario y nada se registra (regla 9).
 */
export async function actualizarWidget(vista: VistaWidget): Promise<void> {
  const modulo = moduloWidget();
  if (!modulo) return;
  try {
    await modulo.requestWidgetUpdate({
      widgetName: NOMBRE_WIDGET,
      renderWidget: () => representacion(vista),
    });
  } catch {
    // Sin el módulo nativo enlazado o con el lanzador sin responder.
  }
}
