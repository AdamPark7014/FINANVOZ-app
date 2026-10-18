/** Redacción de Ajustes (`02 §12`, `02 §14`): tuteo; cifras y estado vienen de `servicios/`. */

export const ETIQUETA_VOLVER = 'Volver';
/** TalkBack: botón atrás en la pantalla raíz de Ajustes. */
export const PISTA_VOLVER = 'Regresa a donde estabas';
export const TITULO = 'Ajustes';

export const MENSAJE_NO_GUARDAR = 'No pude guardar el cambio. Intenta de nuevo.';

export const SECCION_BLOQUEO = 'Bloqueo';
export const ETIQUETA_BLOQUEO = 'Pedir huella o PIN al abrir';
export const DESC_BLOQUEO = 'También al volver después de 1 minuto fuera de la app.';
export const ETIQUETA_MULTITAREA = 'Ocultar en multitarea';
export const DESC_MULTITAREA =
  'La vista previa de apps recientes sale en blanco y no se permiten capturas de pantalla.';

export const SECCION_PRIVACIDAD = 'Privacidad';
export const TEXTO_PRIVACIDAD =
  'Qué se guarda, qué sale de tu teléfono y a quién, tus permisos, descargar o borrar tus datos.';
export const BTN_PRIVACIDAD = 'Abrir el centro de privacidad';

export {
  BTN_ABRIR_DESDE_AJUSTES as BTN_AYUDA,
  SECCION_AJUSTES as SECCION_AYUDA,
  TEXTO_CARD_AJUSTES as TEXTO_AYUDA,
} from '../ayuda/textos';

export const SECCION_ACERCA = 'Acerca de';
export const BTN_TERMINOS = 'Leer los términos de uso';

export const SECCION_DEV = 'Desarrollo · escenarios';
export const TEXTO_DEV =
  'Borra todo y carga el escenario. El reloj queda fijo en su fecha hasta cerrar la app.';

export function etiquetaCargarEscenario(id: string): string {
  return `Cargar ${id}`;
}

export function mensajeErrorCargarEscenario(id: string): string {
  return `No pude cargar ${id}.`;
}

export function lineaVersion(version: string): string {
  return `Finanvoz ${version}`;
}

export function etiquetaAccesibilidadVersion(version: string): string {
  return `Finanvoz versión ${version}`;
}
