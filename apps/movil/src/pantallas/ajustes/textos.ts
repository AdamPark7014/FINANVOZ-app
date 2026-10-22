import { segunPlataforma } from './plataforma';

/** Redacción de Ajustes (`02 §12`, `02 §14`): tuteo; cifras y estado vienen de `servicios/`. */

export const ETIQUETA_VOLVER = 'Volver';
/** TalkBack: botón atrás en la pantalla raíz de Ajustes. */
export const PISTA_VOLVER = 'Regresa a donde estabas';
export const TITULO = 'Ajustes';

export const MENSAJE_NO_GUARDAR = 'No pude guardar el cambio. Intenta de nuevo.';

export const SECCION_BLOQUEO = 'Bloqueo';
export const ETIQUETA_BLOQUEO = 'Pedir huella o PIN al abrir';
export const ETIQUETA_BLOQUEO_IOS = 'Pedir Face ID o código al abrir';
export const DESC_BLOQUEO = 'También al volver después de 1 minuto fuera de la app.';
export const ETIQUETA_MULTITAREA = 'Ocultar en multitarea';
export const DESC_MULTITAREA =
  'La vista previa de apps recientes sale en blanco y no se permiten capturas de pantalla.';
/** iOS no deja bloquear las capturas de pantalla: solo se difumina la vista previa del selector de apps. */
export const DESC_MULTITAREA_IOS =
  'En el selector de apps, la vista previa de Finanvoz sale borrosa para que no se lean tus cifras.';

export function etiquetaBloqueo(os?: string): string {
  return segunPlataforma({ ios: ETIQUETA_BLOQUEO_IOS, android: ETIQUETA_BLOQUEO }, os);
}

export function descMultitarea(os?: string): string {
  return segunPlataforma({ ios: DESC_MULTITAREA_IOS, android: DESC_MULTITAREA }, os);
}

/** Encender el bloqueo pide un desbloqueo con éxito antes (`seguridad/activar.ts`). */
export function confirmacionBloqueoActivo(os?: string): string {
  return segunPlataforma(
    {
      ios: 'Listo: te pediré Face ID o el código al abrir Finanvoz.',
      android: 'Listo: te pediré tu huella o PIN al abrir Finanvoz.',
    },
    os,
  );
}

export function mensajeBloqueoSinSeguridad(os?: string): string {
  return segunPlataforma(
    {
      ios: 'No activé el bloqueo: tu iPhone no tiene código. Ponle uno en Ajustes › Face ID y código y vuelve a intentarlo.',
      android:
        'No activé el bloqueo: tu teléfono no tiene bloqueo de pantalla. Configura un PIN o tu huella en los ajustes del teléfono y vuelve a intentarlo.',
    },
    os,
  );
}

/** El bloqueo estaba encendido pero el teléfono ya no tiene código: se apaga para no dejar la app cerrada. */
export function mensajeBloqueoApagadoSinSeguridad(os?: string): string {
  return segunPlataforma(
    {
      ios: 'Apagué el bloqueo porque tu iPhone ya no tiene código. Ponle uno en Ajustes › Face ID y código para volver a usarlo.',
      android:
        'Apagué el bloqueo porque tu teléfono ya no tiene bloqueo de pantalla. Configura un PIN o tu huella para volver a usarlo.',
    },
    os,
  );
}

export const MENSAJE_BLOQUEO_NO_VERIFICADO =
  'No activé el bloqueo porque no se completó el desbloqueo. Intenta de nuevo.';
export const MENSAJE_BLOQUEO_DEMASIADOS =
  'No activé el bloqueo: hubo muchos intentos. Espera un momento e intenta de nuevo.';

/** Botón para ir a los ajustes del sistema cuando algo depende de ellos (`Linking.openSettings`). */
export const BTN_ABRIR_AJUSTES_SISTEMA = 'Abrir Ajustes';

export function pistaAbrirAjustesSistema(os?: string): string {
  return segunPlataforma(
    { ios: 'Abre la app Ajustes del iPhone', android: 'Abre los ajustes de Finanvoz en el teléfono' },
    os,
  );
}

export const SECCION_PRIVACIDAD = 'Privacidad';
export const TEXTO_PRIVACIDAD =
  'Qué se guarda, qué sale de tu teléfono y a quién, tus permisos, descargar o borrar tus datos.';
export const BTN_PRIVACIDAD = 'Abrir el centro de privacidad';

export {
  BTN_ABRIR_DESDE_AJUSTES as BTN_AYUDA,
  PISTA_ABRIR_DESDE_AJUSTES as PISTA_AYUDA,
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
