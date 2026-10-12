/**
 * Tarea del widget en segundo plano (`02 §21`). Android la despierta al agregar el widget, al cambiarle el tamaño
 * y cada `updatePeriodMillis` (`app.json`, cada 60 min: el "4 días" cambia al pasar la medianoche aunque nadie
 * abra la app). Abre la base, arma la vista con `obtenerVistaWidget` y la pinta. Si la base no se puede abrir
 * (p. ej., antes del primer desbloqueo), muestra "Toca para ver tu día": nunca una cifra vieja ni inventada.
 *
 * Se registra al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso `index.ts` importa
 * este módulo antes que Expo Router. Nada se registra en logs (regla 9).
 */
import { construirVistaWidget, obtenerVistaWidget, type VistaWidget } from '../servicios';
import { abrirSesion, type Sesion } from '../servicios/sesion';
import { moduloWidget, representacion } from './actualizar';

type Accion = 'WIDGET_ADDED' | 'WIDGET_UPDATE' | 'WIDGET_RESIZED' | 'WIDGET_DELETED' | 'WIDGET_CLICK';

/** Lo que mostrar si no se pudo leer la base: sin cifras. */
const SIN_LECTURA: VistaWidget = construirVistaWidget(null, { ocultarMontos: true });

export function vistaEnSegundoPlano(abrir: () => Sesion): VistaWidget {
  let sesion: Sesion | null = null;
  try {
    sesion = abrir();
    return obtenerVistaWidget(sesion.ctx);
  } catch {
    return SIN_LECTURA;
  } finally {
    try {
      sesion?.base.cerrar();
    } catch {
      // Ya estaba cerrada.
    }
  }
}

export async function manejarTareaWidget(
  {
    widgetAction,
    renderWidget,
  }: { widgetAction: Accion; renderWidget: (w: ReturnType<typeof representacion>) => void },
  abrir: () => Sesion,
): Promise<void> {
  // Tocar el widget lo resuelve Android (`OPEN_URI`); al quitarlo no hay nada que pintar.
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(representacion(vistaEnSegundoPlano(abrir)));
}

const modulo = moduloWidget();
if (modulo) {
  modulo.registerWidgetTaskHandler((props) => manejarTareaWidget(props, () => abrirSesion()));
}
