/**
 * Texto del aviso de privacidad de la app (`08 §2`).
 * Mantener alineado con `apps/movil/src/pantallas/onboarding/aviso.ts`.
 * Si cambia el contenido, sube `VERSION_CONSENTIMIENTO` en `config.ts` (y en la app).
 */

import { RESPONSABLE } from './config';

export interface SeccionAviso {
  readonly titulo: string;
  readonly parrafos: readonly string[];
}

/** Aviso completo de la app (mismo contenido que en `/aviso-privacidad` móvil). */
export const AVISO_COMPLETO: readonly SeccionAviso[] = [
  {
    titulo: 'Quién es responsable de tus datos',
    parrafos: [
      `${RESPONSABLE.nombre}, con domicilio en ${RESPONSABLE.domicilio}, es responsable del tratamiento de tus datos personales. Contacto: ${RESPONSABLE.correo}.`,
    ],
  },
  {
    titulo: 'Qué datos tratamos',
    parrafos: [
      'Los datos sobre tu dinero que tú anotas: cuentas, saldos, tarjetas, compras a meses, ingresos, pagos fijos, movimientos y personas a quienes les prestas o que te prestan (solo el nombre que escribes). Son datos financieros y patrimoniales: los tratamos solo con tu consentimiento expreso.',
      'Si activas la captura automática, el texto de los avisos de las apps de banco que elijas. Se procesa en tu teléfono y no se envía a nuestros servidores.',
      'Las frases que dictas o escribes cuando la app no las entiende sola, para interpretarlas.',
      'Si tienes Plus y usas las preguntas abiertas sobre tu dinero: la pregunta que escribes o dictas y los resúmenes agregados que la app calcula en tu teléfono a partir de tu libro (textos con montos formateados y nombres cortos de categorías, cuentas o periodos; no movimientos uno por uno).',
      'Un identificador anónimo de la app, la versión de este aviso que aceptaste y la fecha y hora en que lo aceptaste.',
      'Reportes de errores de la app, sin montos, comercios, nombres ni lo que dictas.',
      'Si las aceptas, estadísticas anónimas de uso: qué funciones usas, nunca montos, comercios, nombres ni lo que dictas.',
      'Si compras Plus, el estado de tu suscripción.',
    ],
  },
  {
    titulo: 'Dónde viven',
    parrafos: [
      'Tus datos financieros se guardan cifrados en tu teléfono y no se copian en los respaldos del sistema. La llave para abrirlos vive en el almacén seguro de tu teléfono.',
    ],
  },
  {
    titulo: 'Para qué los usamos',
    parrafos: [
      'Finalidades necesarias: decirte cuánto puedes gastar hoy, qué pagos vienen y cómo van tus tarjetas; interpretar lo que dictas o escribes; corregir fallas de la app; y, si compras Plus, darte sus funciones (incluidas las preguntas abiertas, enviando solo tu pregunta y resúmenes agregados al proveedor de inteligencia artificial para redactar la respuesta).',
      'Finalidades opcionales: estadísticas anónimas de uso para mejorar la app. Solo se usan si las aceptas y puedes negarte o apagarlas cuando quieras en Ajustes › Privacidad sin perder ninguna función.',
      'No vendemos tus datos ni los usamos para publicidad.',
    ],
  },
  {
    titulo: 'Quién más los trata',
    parrafos: [
      'Estos servicios los tratan por cuenta nuestra, como encargados, y algunos en servidores fuera de México:',
      'Supabase: la sesión anónima de la app, la cuenta de tus interpretaciones del mes y la evidencia de que aceptaste este aviso.',
      'Un proveedor de inteligencia artificial: interpreta al momento las frases que la app no entiende sola; y, con Plus, recibe tu pregunta y los resultados agregados de las consultas que la app ya hizo en tu teléfono (montos formateados y nombres cortos). En ambos casos el tratamiento es al momento y no guarda esos textos.',
      'Sentry: reportes de errores ya limpios.',
      'PostHog: estadísticas anónimas de uso, solo si las aceptas.',
      'Google Play y RevenueCat: tu suscripción, si compras Plus.',
      'Si en el futuro algún otro dato sale de tu teléfono, te lo diremos antes y actualizaremos este aviso.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'En Ajustes › Privacidad puedes descargar todos tus datos (siempre gratis, también si cancelas Plus), borrarlos todos y apagar las estadísticas. Para corregir un dato, edítalo en la app. La captura automática se apaga en Ajustes.',
      `También puedes escribir a ${RESPONSABLE.correo} para acceder a tus datos, corregirlos, pedir que los borremos, oponerte a su uso o revocar tu consentimiento. Te respondemos en los plazos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.`,
    ],
  },
  {
    titulo: 'Cambios a este aviso',
    parrafos: [
      'Si este aviso cambia, publicaremos aquí la versión nueva con su fecha y te la mostraremos en la app.',
    ],
  },
];

/** Datos adicionales solo en esta web (calculadora y lista de espera). */
export const AVISO_WEB: readonly SeccionAviso[] = [
  {
    titulo: 'Esta página web (calculadora y lista de espera)',
    parrafos: [
      'Los montos que escribes en la calculadora se procesan solo en tu navegador: no los recibimos ni los guardamos.',
      'Si te anotas en la lista de espera, tratamos tu correo electrónico, tus respuestas a cuatro preguntas (qué teléfono usas, si tu banco te avisa de cada compra, cuánto pagarías al mes y para qué usarías la app), la versión de este aviso que aceptaste y la fecha y hora en que lo aceptaste. Para evitar abusos, una huella irreversible de tu dirección IP que se borra a las 24 horas; no guardamos la dirección IP.',
      'Los usamos para avisarte del lanzamiento, invitarte a la beta y entender qué necesita la gente. Supabase Inc. los guarda por cuenta nuestra como encargado, en servidores que pueden estar fuera de México. No los vendemos ni los usamos para publicidad.',
      'Cada correo trae un enlace para darte de baja. Los guardamos hasta que te des de baja o hasta 12 meses después del lanzamiento público, lo que pase primero. Si en el futuro usamos un servicio de envío de correos, lo agregaremos a este aviso antes de usarlo.',
    ],
  },
];
