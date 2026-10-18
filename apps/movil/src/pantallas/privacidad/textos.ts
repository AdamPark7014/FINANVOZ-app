import { etiquetaDiaMes } from '../../servicios';
import { RESPONSABLE, type SeccionAviso } from '../onboarding/aviso';
import { TEXTO_NO_ASESORIA, VERSION_TERMINOS } from './legales';

/** Redacción del centro de privacidad y términos (`02 §12`, `02 §14`, `08 §2`): tuteo. */

export { VERSION_TERMINOS };

export const PALABRA_BORRAR = 'BORRAR';

export const TIP_SOLO_LECTURA =
  'Estás en solo lectura: puedes ver y exportar tus datos, pero no registrar hasta que aceptes el aviso nuevo al abrir la app.';

export const ETIQUETA_VOLVER = 'Volver';
export const TITULO_PRIVACIDAD = 'Tu privacidad';
export const INTRO_PRIVACIDAD =
  'Tus datos viven cifrados en este teléfono. Aquí ves qué se guarda, qué sale y a quién, y decides.';

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

export const SECCION_DECISIONES = 'Tus decisiones';
export const ETIQUETA_ESTADISTICAS = 'Compartir estadísticas anónimas de uso';
export const DESC_ESTADISTICAS =
  'Ayudan a mejorar la app. Sin montos, comercios, nombres ni lo que dictas. Si lo apagas no pierdes nada.';

export const SECCION_PERMISOS = 'Permisos del teléfono';
export const BTN_PERMISOS_TELEFONO = 'Revisar permisos en tu teléfono';
export const PISTA_PERMISOS_TELEFONO = 'Abre los ajustes de Finanvoz en Android';

export const PERMISOS: readonly { readonly nombre: string; readonly para: string }[] = [
  { nombre: 'Micrófono', para: 'Para registrar hablando. Solo escucha mientras mantienes el botón.' },
  {
    nombre: 'Acceso a notificaciones',
    para: 'Para la captura automática. Solo lee las apps de banco que elijas; las demás se ignoran sin guardarse.',
  },
  { nombre: 'Notificaciones', para: 'Para avisarte de cortes, fechas límite y arqueos.' },
  { nombre: 'Huella o rostro', para: 'Solo si activas el bloqueo de la app.' },
];

export const SECCION_DATOS = 'Tus datos';
export const TEXTO_DESCARGA_GRATIS =
  'Descárgalos cuando quieras, gratis, también si cancelas Plus.';
export const BTN_EXPORTAR_JSON = 'Descargar todos mis datos (JSON)';
export const BTN_EXPORTAR_CSV = 'Descargar mis movimientos (CSV)';
export const BTN_LEER_AVISO = 'Leer el aviso de privacidad';
export const BTN_LEER_TERMINOS = 'Leer los términos de uso';

export const TITULO_COMPARTIR_JSON = 'Tus datos de Finanvoz';
export const TITULO_COMPARTIR_CSV = 'Tus movimientos de Finanvoz';

export const SECCION_BORRAR = 'Borrar todo';
export const TEXTO_BORRAR_ADVERTENCIA =
  'Se borran de este teléfono todas tus cuentas, tarjetas, movimientos y ajustes. No se puede deshacer. Si quieres conservarlos, primero descarga tus datos.';
export const BTN_BORRAR_CONFIRMAR = 'Borrar todo para siempre';
export const BTN_BORRAR_INICIAR = 'Borrar todos mis datos';
export const BTN_CANCELAR = 'Cancelar';

export const MENSAJE_NO_GUARDAR = 'No pude guardar el cambio. Intenta de nuevo.';
export const MENSAJE_NO_EXPORTAR =
  'No pude preparar el archivo para compartir. Intenta de nuevo.';

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

export function etiquetaConfirmarBorrar(palabra: string = PALABRA_BORRAR): string {
  return `Escribe ${palabra} para confirmar`;
}

export function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function textoCaptura(activada: boolean, appsBanco: number): string {
  return activada
    ? `Captura automática: activa con ${cuenta(appsBanco, 'app de banco', 'apps de banco')}. La apagas en Ajustes.`
    : 'Captura automática: apagada. La activas en Ajustes.';
}

export function textoConsentimiento(version: string, fecha: string): string {
  return `Aceptaste el aviso de privacidad (versión ${version}) el ${etiquetaDiaMes(fecha)} ${fecha.slice(0, 4)}.`;
}

export function lineaPersonas(n: number): string {
  return cuenta(
    n,
    'persona a quien prestas o que te debe',
    'personas a quienes prestas o que te deben',
  );
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
