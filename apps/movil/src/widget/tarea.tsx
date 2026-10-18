/**
 * Tarea del widget en segundo plano (`02 §21`). Android la despierta al agregar el widget, al cambiarle el tamaño
 * y cada `updatePeriodMillis` (`app.json`, cada 60 min: el "4 días" cambia al pasar la medianoche aunque nadie
 * abra la app). Abre la base, arma la vista con `obtenerVistaWidget` y la pinta. Si la base no se puede abrir
 * (p. ej., antes del primer desbloqueo), muestra "Toca para ver tu día": nunca una cifra vieja ni inventada.
 *
 * Se registra al cargar el bundle, también cuando el sistema lo arranca sin interfaz: por eso `index.ts` importa
 * este módulo antes que Expo Router. Nada se registra en logs (regla 9).
 *
 * Agregar y quitar el widget se anotan como eventos pendientes de la analítica (`widget {evento}`, `03 §8`): aquí
 * no hay interfaz ni proveedor de analítica, y la app los envía al volver a primer plano (`SincronizarWidget`).
 */
import { construirVistaWidget, obtenerVistaWidget, type VistaWidget } from '../servicios';
import { abrirSesion, type Sesion } from '../servicios/sesion';
import { anotarEventoWidget, type EventoWidget } from '../servicios/widget';
import { moduloWidget, representacion } from './actualizar';

type Accion = 'WIDGET_ADDED' | 'WIDGET_UPDATE' | 'WIDGET_RESIZED' | 'WIDGET_DELETED' | 'WIDGET_CLICK';

/** Lo que mostrar si no se pudo leer la base: sin cifras. */
const SIN_LECTURA: VistaWidget = construirVistaWidget(null, { ocultarMontos: true });

/** Un fallo al anotar (base ocupada, sin consentimiento) solo pierde el evento: nunca impide pintar. */
function anotar(sesion: Sesion, evento: EventoWidget | null): void {
  if (!evento) return;
  try {
    anotarEventoWidget(sesion.ctx, evento);
  } catch {
    // El evento se pierde en silencio.
  }
}

/** Abre la base, la usa y la cierra siempre; si no se pudo abrir o leer, `siFalla`. */
function conSesion<T>(abrir: () => Sesion, usar: (sesion: Sesion) => T, siFalla: T): T {
  let sesion: Sesion | null = null;
  try {
    sesion = abrir();
    return usar(sesion);
  } catch {
    return siFalla;
  } finally {
    try {
      sesion?.base.cerrar();
    } catch {
      // Ya estaba cerrada.
    }
  }
}

export function vistaEnSegundoPlano(abrir: () => Sesion, evento: EventoWidget | null = null): VistaWidget {
  return conSesion(
    abrir,
    (sesion) => {
      anotar(sesion, evento);
      return obtenerVistaWidget(sesion.ctx);
    },
    SIN_LECTURA,
  );
}

export async function manejarTareaWidget(
  {
    widgetAction,
    renderWidget,
  }: { widgetAction: Accion; renderWidget: (w: ReturnType<typeof representacion>) => void },
  abrir: () => Sesion,
): Promise<void> {
  // Tocar el widget lo resuelve Android (`OPEN_URI`).
  if (widgetAction === 'WIDGET_CLICK') return;
  // Al quitarlo no hay nada que pintar: solo se anota el evento (sin base, p. ej. antes del primer desbloqueo,
  // se pierde).
  if (widgetAction === 'WIDGET_DELETED') {
    conSesion(abrir, (sesion) => anotar(sesion, 'quitado'), undefined);
    return;
  }
  const evento = widgetAction === 'WIDGET_ADDED' ? 'agregado' : null;
  renderWidget(representacion(vistaEnSegundoPlano(abrir, evento)));
}

const modulo = moduloWidget();
if (modulo) {
  modulo.registerWidgetTaskHandler((props) => manejarTareaWidget(props, () => abrirSesion()));
}
