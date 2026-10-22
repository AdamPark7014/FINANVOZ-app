import { etiquetaDiaMes } from '../../servicios';
import { enteroEnPalabras, etiquetaHablada } from '../../ui/formato';
import { segunPlataforma } from '../ajustes/plataforma';
import { RESPONSABLE, type SeccionAviso } from '../onboarding/aviso';
import { TEXTO_NO_ASESORIA, VERSION_TERMINOS } from './legales';

/** Redacción del centro de privacidad y términos (`02 §12`, `02 §14`, `08 §2`): tuteo. */

export { VERSION_TERMINOS };

export const PALABRA_BORRAR = 'BORRAR';

export const TIP_SOLO_LECTURA =
  'Estás en solo lectura: puedes ver y exportar tus datos, pero no registrar movimientos nuevos hasta que aceptes el aviso al abrir la app.';

/** Pantalla `/reconsentimiento` cuando sube `VERSION_CONSENTIMIENTO` (`08 §2`, pendiente 31). */
export const TITULO_RECONSENTIMIENTO = 'Actualizamos el aviso de privacidad';

export function introReconsentimiento(version: string): string {
  return `Publicamos una versión nueva del aviso (${version}). Si no la aceptas ahora, entras en solo lectura: puedes ver y exportar tus datos, pero no registrar movimientos nuevos hasta que la aceptes al abrir la app.`;
}

export function etiquetaIntroReconsentimiento(version: string): string {
  return etiquetaHablada(introReconsentimiento(version));
}

export const CASILLA_RECONSENT_DATOS =
  'Acepto esta versión del aviso de privacidad y que Finanvoz siga guardando y usando mis datos financieros, como ahí se describe.';

export const CASILLA_ESTADISTICAS_OPCIONAL =
  'Compartir estadísticas anónimas de uso para mejorar la app (opcional).';

export const BTN_RECONSENT_ACEPTAR = 'Aceptar y continuar';
export const BTN_RECONSENT_SOLO_LECTURA = 'Continuar en solo lectura';
export const BTN_RECONSENT_BORRAR = 'Borrar todo';
export const PISTA_CASILLA_DATOS_FINANCIEROS = 'Primero marca la casilla de tus datos financieros';
export const PISTA_RECONSENT_ACEPTAR = 'Actualiza tu consentimiento y abre tu día';
export const PISTA_RECONSENT_SOLO_LECTURA =
  'Entras en solo lectura y abres tu día sin aceptar el aviso nuevo';
/** Abre la confirmación (escribir BORRAR); un toque nunca borra nada. */
export const PISTA_RECONSENT_BORRAR = 'Muestra la confirmación para borrar todos los datos de este teléfono';

/** Desde O2, reconsentimiento o Ajustes: abre `/aviso-privacidad`. */
export const BTN_LEER_AVISO_COMPLETO = 'Leer el aviso completo';
export const PISTA_LEER_AVISO_COMPLETO = 'Abre el aviso de privacidad completo en otra pantalla';

export const TITULO_AVISO_PRIVACIDAD = 'Aviso de privacidad';
export const TIP_AVISO_PRIVACIDAD =
  'Solo lectura: aquí no aceptas el aviso. Para hacerlo, regresa a la pantalla anterior o acéptalo cuando te lo pidamos al abrir la app.';
export const PISTA_VOLVER = 'Regresa a donde estabas';

export function lineaVersionAviso(version: string): string {
  return `Versión ${version}`;
}

export const ETIQUETA_VOLVER = 'Volver';
export const ACCESIBILIDAD_VOLVER = 'Volver a ajustes';
export const TITULO_PRIVACIDAD = 'Tu privacidad';
export const INTRO_PRIVACIDAD =
  'Tus datos viven cifrados en este teléfono. Aquí ves qué se guarda, qué sale y a quién, y decides.';

export function etiquetaAccesibleIntroPrivacidad(): string {
  return etiquetaHablada(INTRO_PRIVACIDAD);
}

export const SECCION_GUARDADO = 'Qué se guarda en este teléfono';
export const TEXTO_GUARDADO_VACIO =
  'Todavía no hay cuentas, movimientos ni avisos guardados aquí. Cuando registres algo, lo verás en esta lista.';
export const NOTA_CIFRADO_GUARDADO =
  'Todo se guarda cifrado con una llave que solo existe en este teléfono. No se copia en los respaldos del sistema.';

export const SUFIJO_AVISOS_BANCO = '(se borran a los 30 días)';

export const SECCION_SALE = 'Qué sale de tu teléfono y a quién';
export const NOTA_SERVICIOS_FUERA_MX = 'Algunos de estos servicios procesan datos fuera de México.';
export const TEXTO_NUNCA_SALEN =
  'Nunca salen: tus movimientos, saldos, cuentas ni el texto de los avisos de tu banco.';

/** Qué sale del teléfono y a quién (`08 §2`, remisiones a encargados). */
export const SALE_DEL_TELEFONO: readonly { readonly que: string; readonly quien: string }[] = [
  {
    que: 'Las frases que dictas o escribes y la app no entiende sola',
    quien:
      'Van a nuestro servidor (Supabase) y a un proveedor de inteligencia artificial para interpretarlas. Se procesan al momento y no las guardamos.',
  },
  {
    que: 'Un identificador anónimo de la app y cuántas frases interpretaste en el mes',
    quien: 'Nuestro servidor (Supabase), para contar tu cuota.',
  },
  {
    que: 'Reportes de errores, sin montos, comercios, nombres ni lo que dictas',
    quien: 'Sentry.',
  },
  {
    que: 'Estadísticas anónimas de uso, solo si las activas abajo',
    quien: 'PostHog. Nunca llevan montos, comercios, nombres ni lo que dictas.',
  },
  {
    que: 'Tu suscripción, si compras Plus',
    quien: 'Google Play y RevenueCat.',
  },
];

/**
 * Qué sale del teléfono según la plataforma: en iPhone Plus todavía no se vende (no hay compras en iOS), así que no
 * sale nada hacia una tienda ni hacia RevenueCat y esa fila no aparece.
 */
export function saleDelTelefono(os?: string): readonly { readonly que: string; readonly quien: string }[] {
  return segunPlataforma(
    { ios: SALE_DEL_TELEFONO.filter((s) => !s.quien.includes('RevenueCat')), android: SALE_DEL_TELEFONO },
    os,
  );
}

export const SECCION_DECISIONES = 'Tus decisiones';
export const ETIQUETA_ESTADISTICAS = 'Compartir estadísticas anónimas de uso';
export const DESC_ESTADISTICAS =
  'Ayudan a mejorar la app. Sin montos, comercios, nombres ni lo que dictas. Si lo apagas no pierdes nada.';

export const SECCION_PERMISOS = 'Permisos del teléfono';
export const BTN_PERMISOS_TELEFONO = 'Revisar permisos en tu teléfono';
export const PISTA_PERMISOS_TELEFONO = 'Abre los ajustes de Finanvoz en Android';
export const PISTA_PERMISOS_TELEFONO_IOS = 'Abre Finanvoz en la app Ajustes del iPhone';

export function pistaPermisosTelefono(os?: string): string {
  return segunPlataforma({ ios: PISTA_PERMISOS_TELEFONO_IOS, android: PISTA_PERMISOS_TELEFONO }, os);
}

export const PERMISOS: readonly { readonly nombre: string; readonly para: string }[] = [
  { nombre: 'Micrófono', para: 'Para registrar hablando. Solo escucha mientras mantienes el botón.' },
  {
    nombre: 'Acceso a notificaciones',
    para: 'Para la captura automática. Solo lee las apps de banco que elijas; las demás se ignoran sin guardarse.',
  },
  { nombre: 'Notificaciones', para: 'Para avisarte de cortes, fechas límite y arqueos.' },
  { nombre: 'Huella o rostro', para: 'Solo si activas el bloqueo de la app.' },
];

/** iPhone: no hay acceso a notificaciones de otras apps (la captura automática es solo de Android). */
export const PERMISOS_IOS: readonly { readonly nombre: string; readonly para: string }[] = [
  { nombre: 'Micrófono', para: 'Para registrar hablando. Solo escucha mientras mantienes el botón.' },
  { nombre: 'Reconocimiento de voz', para: 'Para convertir en texto lo que dictas.' },
  { nombre: 'Notificaciones', para: 'Para avisarte de cortes, fechas límite y arqueos.' },
  { nombre: 'Face ID', para: 'Solo si activas el bloqueo de la app.' },
];

export function permisosTelefono(os?: string): readonly { readonly nombre: string; readonly para: string }[] {
  return segunPlataforma({ ios: PERMISOS_IOS, android: PERMISOS }, os);
}

export const SECCION_DATOS = 'Tus datos';
export const TEXTO_DESCARGA_GRATIS = 'Descárgalos cuando quieras, gratis, también si cancelas Plus.';
export const BTN_EXPORTAR_JSON = 'Descargar todos mis datos (JSON)';
export const BTN_EXPORTAR_CSV = 'Descargar mis movimientos (CSV)';
export const PISTA_EXPORTAR_JSON = 'Prepara un archivo con todos tus datos para compartir';
export const PISTA_EXPORTAR_CSV = 'Prepara un archivo con tus movimientos para compartir';
export const BTN_LEER_AVISO = 'Leer el aviso de privacidad';
export const BTN_LEER_TERMINOS = 'Leer los términos de uso';
export const PISTA_LEER_AVISO = 'Abre el aviso de privacidad en otra pantalla';
export const PISTA_LEER_TERMINOS = 'Abre los términos de uso en otra pantalla';

export const TITULO_COMPARTIR_JSON = 'Tus datos de Finanvoz';
export const TITULO_COMPARTIR_CSV = 'Tus movimientos de Finanvoz';

export const SECCION_BORRAR = 'Borrar todo';
export const TEXTO_BORRAR_ADVERTENCIA =
  'Se borran de este teléfono todas tus cuentas, tarjetas, movimientos y ajustes. No se puede deshacer. Si quieres conservarlos, primero descarga tus datos.';
export const BTN_BORRAR_CONFIRMAR = 'Borrar todo para siempre';
export const BTN_BORRAR_INICIAR = 'Borrar todos mis datos';
export const PISTA_BORRAR_INICIAR = 'Muestra la confirmación para borrar todos tus datos';
export const PISTA_BORRAR_CONFIRMAR = 'Borra de este teléfono cuentas, movimientos y ajustes';
export const PISTA_BORRAR_CANCELAR = 'Cierra la confirmación sin borrar nada';
export const BTN_CANCELAR = 'Cancelar';

export const MENSAJE_NO_GUARDAR = 'No pude guardar el cambio. Intenta de nuevo.';
export const MENSAJE_NO_EXPORTAR = 'No pude preparar el archivo para compartir. Intenta de nuevo.';

export const TITULO_TERMINOS = 'Términos de uso';

/** Resumen de `08 §1` en pantalla; el detalle legal largo sigue en `legales.ts`. */
export const TERMINOS_CORTO: readonly SeccionAviso[] = [
  {
    titulo: 'Qué es Finanvoz',
    parrafos: [
      'Registras y revisas tus finanzas con lo que capturas o llega a tu teléfono. Te damos estimaciones con tu historial.',
    ],
  },
  {
    titulo: 'Qué no es',
    parrafos: [
      TEXTO_NO_ASESORIA,
      'Finanvoz no mueve dinero, no ofrece crédito, no recomienda valores ni se conecta a tus cuentas con tus claves del banco. Las decisiones sobre tu dinero son tuyas.',
    ],
  },
  {
    titulo: 'Tus datos y planes',
    parrafos: [
      'Tus datos viven cifrados en tu teléfono; puedes exportarlos o borrarlos gratis en Privacidad. Registrar y descargar es gratis; Plus agrega análisis y preguntas abiertas con resúmenes agregados, no tu libro completo.',
    ],
  },
  {
    titulo: 'Beta y contacto',
    parrafos: [
      'Esta es una versión beta: puede tener errores; escríbenos si algo no cuadra.',
      `${RESPONSABLE.nombre}. ${RESPONSABLE.domicilio}. ${RESPONSABLE.correo}.`,
    ],
  },
];

export function lineaVersionTerminos(version: string = VERSION_TERMINOS): string {
  return `Versión ${version}`;
}

export function etiquetaAccesibilidadVersionTerminos(version: string = VERSION_TERMINOS): string {
  return `Términos de uso, versión ${version}`;
}

export function textoDerechosArco(correo: string = RESPONSABLE.correo): string {
  return `Para ejercer tus derechos o revocar tu consentimiento también puedes escribir a ${correo}.`;
}

export function etiquetaAccesibleDerechosArco(correo: string = RESPONSABLE.correo): string {
  return etiquetaHablada(textoDerechosArco(correo));
}

export function etiquetaConfirmarBorrar(palabra: string = PALABRA_BORRAR): string {
  return `Escribe ${palabra} para confirmar`;
}

export function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export const TEXTO_CAPTURA_IOS =
  'Captura automática: no existe en iPhone, porque iOS no deja que una app lea los avisos de otras. Tus pagos los dictas o los escribes.';

export function textoCaptura(activada: boolean, appsBanco: number, os?: string): string {
  if (segunPlataforma({ ios: true, android: false }, os)) return TEXTO_CAPTURA_IOS;
  return activada
    ? `Captura automática: activa con ${cuenta(appsBanco, 'app de banco', 'apps de banco')}. La apagas en Ajustes.`
    : 'Captura automática: apagada. La activas en Ajustes.';
}

export function etiquetaAccesibleCaptura(activada: boolean, appsBanco: number, os?: string): string {
  return etiquetaHablada(textoCaptura(activada, appsBanco, os));
}

export function textoConsentimiento(version: string, fecha: string): string {
  return `Aceptaste el aviso de privacidad (versión ${version}) el ${etiquetaDiaMes(fecha)} ${fecha.slice(0, 4)}.`;
}

export function etiquetaAccesibleConsentimiento(version: string, fecha: string): string {
  return etiquetaHablada(textoConsentimiento(version, fecha));
}

export function etiquetaLineaGuardado(linea: string): string {
  const m = /^(\d+) (.*)$/.exec(linea);
  if (m) {
    const n = Number(m[1]);
    if (Number.isSafeInteger(n) && n >= 0) {
      return `${enteroEnPalabras(n)} ${m[2]}`;
    }
  }
  return etiquetaHablada(linea);
}

export const TEXTO_SIN_CONSENTIMIENTO =
  'Todavía no consta aquí que aceptaste el aviso; al abrir la app te lo pedimos de nuevo si hace falta.';

export function lineaPersonas(n: number): string {
  return cuenta(n, 'persona a quien prestas o que te debe', 'personas a quienes prestas o que te deben');
}

export function lineaAvisosBanco(n: number): string {
  return `${cuenta(n, 'aviso de banco', 'avisos de banco')} ${SUFIJO_AVISOS_BANCO}`;
}

export type ConteosGuardado = {
  cuentas: number;
  tarjetas: number;
  movimientos: number;
  personas: number;
  textosNotificacion: number;
  frasesPorInterpretar: number;
};

export function guardadoVacio(g: ConteosGuardado): boolean {
  return (
    g.cuentas === 0 &&
    g.tarjetas === 0 &&
    g.movimientos === 0 &&
    g.personas === 0 &&
    g.textosNotificacion === 0 &&
    g.frasesPorInterpretar === 0
  );
}

export function lineasGuardado(g: ConteosGuardado): readonly string[] {
  return [
    cuenta(g.cuentas, 'cuenta', 'cuentas'),
    cuenta(g.tarjetas, 'tarjeta', 'tarjetas'),
    cuenta(g.movimientos, 'movimiento', 'movimientos'),
    lineaPersonas(g.personas),
    lineaAvisosBanco(g.textosNotificacion),
    cuenta(g.frasesPorInterpretar, 'frase esperando internet', 'frases esperando internet'),
  ];
}
