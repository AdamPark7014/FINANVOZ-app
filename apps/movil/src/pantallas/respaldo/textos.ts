import { MIN_CONTRASENA_RESPALDO } from '../../servicios';

/** Redacción de respaldo y restaurar (`02 §19`, `02 §14`): tuteo; cifras y errores de dominio en `servicios/`. */

export {
  MENSAJE_NO_ABRE,
  mensajeErrorRespaldo,
  mensajeRestaurado,
  resumenRespaldo,
} from '../../servicios/respaldo';

export { mensajeErrorNube } from '../../servicios/respaldo-nube';

export const ETIQUETA_VOLVER = 'Volver';
/** TalkBack en Ajustes → Respaldo (`02 §15`). */
export const ACCESIBILIDAD_VOLVER = 'Volver a ajustes';
export const PISTA_VOLVER = 'Cierra esta pantalla';
/** TalkBack en restaurar (onboarding, privacidad o respaldo). */
export const ACCESIBILIDAD_VOLVER_RESTAURAR = 'Volver';
export const PISTA_VOLVER_RESTAURAR = 'Regresa al paso anterior';
export const PISTA_BORRAR_CUENTA = 'Elimina tu cuenta de respaldo en la nube';
/** TalkBack al confirmar borrar cuenta (`02 §19`). */
export const PISTA_CONFIRMAR_BORRAR_CUENTA =
  'Confirma borrar la cuenta y todos los respaldos en la nube';
export const TITULO_RESPALDO = 'Respaldo';
export const SUBTITULO_NUBE = 'En la nube';
export const AVISO_PENDIENTE = 'Llevas más de 2 semanas sin respaldo.';

export const TEXTO_SESION_VENCIDA =
  'Tu sesión de respaldo venció. Vuelve a entrar con tu correo y el código para seguir respaldando.';
export const TEXTO_ACTIVAR_NUBE =
  'Guarda tu respaldo cifrado en la nube con tu correo. Te mando un código para confirmarlo.';

export const MENSAJE_LISTO_NUBE = 'Listo: tu respaldo está en la nube.';
export const MENSAJE_BORRAR_CUENTA_OK =
  'Listo: borré tu cuenta de respaldo y tus respaldos de la nube.';
export const MENSAJE_CORREO_CUENTA_OK = 'Listo: tu correo quedó como cuenta de respaldo.';
export const MENSAJE_CONTRASENA_GUARDADA = 'Listo: guardé tu contraseña de respaldo.';
export const MENSAJE_NO_GUARDAR_AJUSTE = 'No pude guardar el cambio. Intenta de nuevo.';

export function textoRespaldasCon(correo: string): string {
  return `Respaldas con ${correo}.`;
}

export function textoCrearContrasenaTrasCorreo(correo: string): string {
  return `${textoRespaldasCon(correo)} Ahora crea la contraseña que cifra tus respaldos.`;
}

export const BTN_RESPALDAR_AHORA = 'Respaldar ahora';
/** TalkBack en cuenta de respaldo activa (`02 §19`). */
export const PISTA_RESPALDAR_AHORA = 'Sube a la nube una copia cifrada de tus datos';
export const ETIQUETA_RESPALDO_AUTOMATICO = 'Respaldo automático';
export const DESC_RESPALDO_AUTOMATICO =
  'Cada semana, aunque no abras la app. No te pido la contraseña.';
export const ETIQUETA_SOLO_WIFI = 'Solo con Wi-Fi';
export const DESC_SOLO_WIFI = 'Así no gasta tus datos móviles.';
export const BTN_BORRAR_CUENTA = 'Borrar cuenta de respaldo';
export const AVISO_BORRAR_CUENTA =
  'Se borran todos tus respaldos de la nube y tu correo. Lo que hay en este teléfono no cambia.';
export const BTN_BORRAR_CUENTA_CONFIRMAR = 'Borrar cuenta';
export const BTN_CANCELAR = 'Cancelar';

export const SUBTITULO_ARCHIVO = 'Respaldo cifrado';
export const DESCRIPCION_ARCHIVO =
  'Un archivo con todos tus datos, cifrado con una contraseña que solo tú conoces. Guárdalo donde quieras y úsalo para pasar tus datos a otro teléfono.';
export const BTN_EXPORTAR_ARCHIVO = 'Exportar respaldo (.cartera)';
/** TalkBack cuando ya hay contraseña (`02 §19`). */
export const PISTA_EXPORTAR_ARCHIVO =
  'Genera un archivo cifrado para guardarlo o pasarlo a otro teléfono';
export const BTN_CAMBIAR_CONTRASENA = 'Cambiar contraseña';
export const BTN_CREAR_CONTRASENA = 'Crear contraseña de respaldo';
export const BTN_RESTAURAR_RESPALDO = 'Restaurar un respaldo';
export const MENSAJE_NO_EXPORTAR = 'No pude preparar tu respaldo. Intenta de nuevo.';

/** Aviso antes de crear la contraseña (`02 §19`, `05 §E16`). */
export const AVISO_CONTRASENA =
  'Esta contraseña cifra tu respaldo. Ni nosotros la conocemos: si la olvidas, nadie puede recuperar tu respaldo.';
export const TEXTO_RESPALDOS_ANTERIORES =
  'Tus respaldos anteriores se siguen abriendo con la contraseña anterior.';
export const ETIQUETA_CONTRASENA_NUEVA = 'Contraseña nueva';
export const ETIQUETA_CONTRASENA = 'Contraseña del respaldo';
export const ETIQUETA_CONFIRMAR_CONTRASENA = 'Escríbela otra vez';
export const BTN_GUARDAR_CONTRASENA = 'Guardar contraseña';
/** TalkBack al guardar la contraseña de cifrado (`02 §19`). */
export const PISTA_GUARDAR_CONTRASENA =
  'Guarda la llave que cifra tus respaldos en este teléfono';
/** TalkBack al cerrar el formulario de contraseña (`02 §19`). */
export const PISTA_CANCELAR_CONTRASENA = 'Cierra sin guardar la contraseña de respaldo';
export const ERROR_CONTRASENAS_NO_COINCIDEN = 'Las contraseñas no coinciden.';
export const MENSAJE_NO_GUARDAR_CONTRASENA = 'No pude guardar la contraseña. Intenta de nuevo.';

export function errorContrasenaCorta(): string {
  return `Usa al menos ${MIN_CONTRASENA_RESPALDO} caracteres.`;
}

export function ayudaContrasena(): string {
  return `Al menos ${MIN_CONTRASENA_RESPALDO} caracteres. Una frase de varias palabras es fácil de recordar.`;
}

export const ETIQUETA_CORREO = 'Tu correo';
export const BTN_ENVIAR_CODIGO = 'Enviarme el código';

export function textoCodigoEnviado(correo: string): string {
  return `Te mandé un código a ${correo.trim().toLowerCase()}. Escríbelo aquí.`;
}

export const ETIQUETA_CODIGO = 'Código de 6 dígitos';
export const BTN_CONFIRMAR = 'Confirmar';
export const BTN_USAR_OTRO_CORREO = 'Usar otro correo';

export const TITULO_RESTAURAR = 'Restaurar un respaldo';
export const INTRO_RESTAURAR_NUBE =
  'Recupera tus cuentas, movimientos y ajustes desde tu respaldo en la nube o desde un archivo .cartera.';
export const INTRO_RESTAURAR_ARCHIVO =
  'Recupera tus cuentas, movimientos y ajustes desde un archivo .cartera que exportaste antes.';
export const RESTAURAR_NO_DISPONIBLE = 'Restaurar no está disponible en esta versión de la app.';
export const BTN_DESDE_NUBE = 'Desde la nube';
export const BTN_DESDE_ARCHIVO = 'Desde un archivo';
export const BTN_ELEGIR_ARCHIVO = 'Elegir archivo';
export const TEXTO_CORREO_RESTAURAR =
  'Escribe el correo de tu cuenta de respaldo. Te mando un código para entrar.';
export const TEXTO_BAJANDO = 'Bajando tu respaldo…';
export const BTN_VOLVER_A_ELEGIR = 'Volver a elegir';
export const TEXTO_RESPALDO_RECIENTE = 'Encontré tu respaldo más reciente. Escribe su contraseña.';
export const BTN_ABRIR_RESPALDO = 'Abrir respaldo';
export const BTN_ELEGIR_OTRO_ARCHIVO = 'Elegir otro archivo';
export const AVISO_REEMPLAZA_DATOS =
  'Se reemplaza todo lo que hay ahora en este teléfono. Si quieres conservarlo, primero exporta un respaldo.';
export const BTN_RESTAURAR = 'Restaurar';

/** Tarjeta en Ajustes (`02 §12`). */
export const SECCION_RESPALDO = 'Respaldo';
export const BTN_RESPALDAR_RESTAURAR = 'Respaldar y restaurar';

/** Bienvenida · teléfono nuevo (`02 §19`). */
export const BTN_ONBOARDING_RESTAURAR = '¿Vienes de otro teléfono? Restaurar respaldo';
export const PISTA_ONBOARDING_RESTAURAR =
  'Recupera tus datos desde un respaldo en la nube o un archivo';
