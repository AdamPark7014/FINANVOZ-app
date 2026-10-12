/**
 * Aviso de privacidad de la app (`08 §2`): el simplificado se muestra en O2 y el completo en la pantalla
 * `/aviso-privacidad` (también desde Ajustes). El texto corresponde a `VERSION_CONSENTIMIENTO`: si cambia,
 * cambia la versión. Pendiente la revisión legal (ESTADO, pendiente 4).
 */

export const RESPONSABLE = {
  nombre: 'NEW ENGINEERING EXPERTISE AND RESOURCE ADVANCEMENT S.A. DE C.V. (NEXARA)',
  domicilio: 'Ignacio Allende 512 local 2, Santiago Momoxpan, San Pedro Cholula, Puebla, C.P. 72775',
  correo: 'gerencia@nexara.com.mx',
} as const;

/** Puntos del aviso simplificado (O2). */
export const AVISO_SIMPLIFICADO: readonly string[] = [
  `${RESPONSABLE.nombre} es responsable de tus datos.`,
  'Lo que anotas sobre tu dinero (cuentas, saldos, tarjetas, pagos y movimientos) se guarda cifrado solo en tu teléfono.',
  'Lo usamos para decirte cuánto puedes gastar hoy y recordarte tus pagos.',
  'Si la app falla, enviamos un reporte del error sin montos, nombres ni comercios.',
  'Puedes descargar tus datos o borrarlos todos cuando quieras desde Ajustes.',
];

export interface SeccionAviso {
  readonly titulo: string;
  readonly parrafos: readonly string[];
}

/** Aviso completo dentro de la app. */
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
      'Los datos sobre tu dinero que tú anotas: cuentas, saldos, tarjetas, compras a meses, ingresos, pagos fijos, movimientos y personas a quienes les prestas o que te prestan (solo el nombre que escribes).',
      'La versión de este aviso que aceptaste, con la fecha y hora en que lo aceptaste.',
      'Reportes de errores de la app, sin montos, comercios, nombres ni lo que dictas.',
    ],
  },
  {
    titulo: 'Dónde viven',
    parrafos: [
      'Tus datos se guardan cifrados en tu teléfono. No los subimos a ningún servidor. La llave para abrirlos vive en el almacén seguro de tu teléfono.',
    ],
  },
  {
    titulo: 'Para qué los usamos',
    parrafos: [
      'Para decirte cuánto puedes gastar hoy, qué pagos vienen y cómo van tus tarjetas.',
      'Las estadísticas anónimas de uso son opcionales: solo se usan si las aceptas y puedes negarte sin perder ninguna función.',
    ],
  },
  {
    titulo: 'Quién más los trata',
    parrafos: [
      'Sentry recibe los reportes de errores ya limpios, como encargado, en servidores que pueden estar fuera de México. Si en el futuro algún dato más sale de tu teléfono, te lo diremos antes y actualizaremos este aviso.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'En Ajustes puedes descargar todos tus datos (siempre gratis) y borrarlos todos. Para corregir un dato, edítalo en la app.',
      `También puedes escribir a ${RESPONSABLE.correo} para acceder a tus datos, corregirlos, pedir que los borremos, oponerte a su uso o revocar tu consentimiento. Te respondemos en los plazos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.`,
    ],
  },
  {
    titulo: 'Cambios a este aviso',
    parrafos: ['Si este aviso cambia, publicaremos aquí la versión nueva con su fecha.'],
  },
];
