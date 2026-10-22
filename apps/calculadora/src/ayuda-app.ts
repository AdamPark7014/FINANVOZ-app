/**
 * Preguntas frecuentes de Ajustes › Ayuda, para la página pública de soporte (`soporte.html`) que piden las
 * tiendas. Copia palabra por palabra de `apps/movil/src/pantallas/ayuda/textos.ts` (CA-M13-04): si cambia una
 * respuesta en la app, cambia aquí en el mismo commit. Los valores interpolados en la app
 * (`INTERPRETACIONES_NUBE_MES` = 30 Gratis / 300 Plus, `LEYENDA_ESTIMACION`) van escritos.
 */

export interface PreguntaFrecuente {
  readonly id: string;
  readonly pregunta: string;
  /** Párrafos cortos (redacción de Android, la completa). */
  readonly respuesta: readonly string[];
  /** Párrafos que cambian en iPhone (sin captura automática, sin Google Play, con Face ID). */
  readonly iphone?: readonly string[];
}

/** Asunto fijo del correo de ayuda (igual que en la app). */
export const ASUNTO_CORREO_AYUDA = 'Ayuda con Finanvoz';

export const CONTACTO_TITULO = '¿No encontraste tu respuesta?';

export function textoCuerpoContacto(correo: string): string {
  return `Escríbenos a ${correo}. Cuéntanos qué pasó; no mandes contraseñas ni datos de tarjetas.`;
}

export const PREGUNTAS_FRECUENTES: readonly PreguntaFrecuente[] = [
  {
    id: 'captura',
    pregunta: '¿Cómo anota Finanvoz mis compras sin que las escriba?',
    respuesta: [
      'Leo los avisos de las apps de banco que marques en Ajustes › Captura. Solo esas notificaciones; el resto se ignora en tu teléfono. Todo se procesa aquí, no en nuestros servidores.',
      'Tu banco debe mandar avisos de compras. Lo dudoso va a Por revisar; si dejo de ver tu banco 3 días, te aviso. Por ahora solo Android.',
    ],
    iphone: [
      'En iPhone no puedo leer los avisos de tu banco: iOS no deja que una app lea las notificaciones de otras.',
      'Dicta tu gasto, como «tacos 80 en efectivo», o escríbelo. Lo dudoso va a Por revisar.',
    ],
  },
  {
    id: 'permisos',
    pregunta: '¿Qué permisos pide la app y para qué?',
    respuesta: [
      'Micrófono mientras mantienes el botón de voz; acceso a notificaciones para la captura (si Android te bloquea, «Permitir ajustes restringidos» en la app); avisos de cortes y arqueos; huella o rostro si activas el bloqueo.',
      'Ninguno es obligatorio: puedes escribir todo a mano. Los revisas en Ajustes › Privacidad › Revisar permisos en tu teléfono.',
    ],
    iphone: [
      'Micrófono y reconocimiento de voz para dictar; avisos de cortes y arqueos; Face ID si activas el bloqueo.',
      'Ninguno es obligatorio: puedes escribir todo a mano. Los revisas en Ajustes › Privacidad › Revisar permisos en tu teléfono.',
    ],
  },
  {
    id: 'efectivo',
    pregunta: '¿Cómo lleva la app mi efectivo?',
    respuesta: [
      'Los gastos en efectivo los dictas o escribes. De vez en cuando te pido contar lo que traes (arqueo), sobre todo 48 h después de un cajero o si llevas días gastando sin contar. También en Cuentas › Contar mi efectivo.',
      'Si falta dinero, reparto la diferencia entre tus gastos en efectivo y puedes ajustarlo. Si sobra, te pregunto de dónde salió antes de anotar.',
    ],
  },
  {
    id: 'tarjetas',
    pregunta: '¿Cómo maneja mis tarjetas de crédito y meses sin intereses?',
    respuesta: [
      'Con saldo del banco, corte y fecha límite ves cuánto debes, el pago sin intereses y cuándo vence. Te aviso 3 días antes de la fecha límite y el día de corte.',
      'Las compras a meses van cuota por cuota. Pasar a meses, agregar o liquidar desde Movimientos o la tarjeta. Si no cuadra el saldo, Corregir saldo. En cargos de $1,000 o más te pregunto si fue a meses.',
    ],
  },
  {
    id: 'hoy-puedes',
    pregunta: '¿Cómo calculas mi «hoy puedes»?',
    respuesta: [
      'Resto de efectivo, débito y billeteras menos lo comprometido antes de tu próximo ingreso: pagos fijos, tarjetas, meses que vencen, deudas con personas (salvo con «Apartar lo que le debo») y tu colchón.',
      'Lo reparto entre los días hasta tu ingreso, redondeado abajo. Toca la cifra para el desglose. Si falta un dato, cuento de más lo que debes.',
    ],
  },
  {
    id: 'respaldo',
    pregunta: '¿Cómo respaldo mis datos o los paso a otro teléfono?',
    respuesta: [
      'Ajustes › Respaldo: nube con tu correo, archivo .cartera a mano o copia automática semanal (opcional solo Wi-Fi). Va cifrado con una contraseña que solo tú conoces.',
      'En otro teléfono: instala Finanvoz › «Restaurar respaldo» con correo y contraseña o tu archivo. El respaldo es gratis.',
    ],
    iphone: [
      'Ajustes › Respaldo: exporta un archivo .cartera y guárdalo en Archivos o mándatelo. Si ves la opción de la nube, también puedes respaldar ahí con tu correo. Va cifrado con una contraseña que solo tú conoces.',
      'En otro teléfono: instala Finanvoz › «Restaurar respaldo» con tu archivo (o tu correo, si respaldaste en la nube) y tu contraseña. El respaldo es gratis.',
    ],
  },
  {
    id: 'privacidad',
    pregunta: '¿Quién puede ver mis datos?',
    respuesta: [
      'Cuentas, saldos y movimientos cifrados solo en tu teléfono. Solo salen dentro de tu respaldo cifrado si lo activas.',
      'Las frases que no entiendo van al servidor para interpretarlas y no las guardamos. Con Plus, preguntas libres pueden llevar totales y nombres cortos de cuentas. En Ajustes › Privacidad ves qué sale y decides.',
    ],
  },
  {
    id: 'plus',
    pregunta: '¿Qué incluye Plus y qué pasa si lo cancelo?',
    respuesta: [
      'Plus: probabilidad de llegar al pago, «¿Me alcanza?», tarjeta del día, meses a 12 meses, preguntas libres, deducciones y 300 frases al mes en internet (Gratis, 30).',
      'Gratis: «hoy puedes», captura, voz, cuentas y tarjetas, avisos, arqueo, respaldo y exportar o borrar datos. Precio y prueba en Ajustes › Plan; cobro en Google Play. Si cancelas, vuelves a Gratis sin perder datos.',
    ],
    iphone: [
      'Plus: probabilidad de llegar al pago, «¿Me alcanza?», tarjeta del día, meses a 12 meses, preguntas libres, deducciones y 300 frases al mes en internet (Gratis, 30).',
      'Gratis: «hoy puedes», voz, cuentas y tarjetas, avisos, arqueo, respaldo y exportar o borrar datos. En iPhone, Plus todavía no se vende en la App Store. Si cancelas, vuelves a Gratis sin perder datos.',
    ],
  },
  {
    id: 'borrar',
    pregunta: '¿Cómo descargo o borro mis datos?',
    respuesta: [
      'Ajustes › Privacidad: «Descargar todos mis datos» (gratis) o «Borrar todos mis datos» en este teléfono; confirmas escribiendo BORRAR y no se deshace.',
      'Respaldo en la nube: Ajustes › Respaldo › Borrar cuenta de respaldo. Borrar datos no cancela Plus; eso es en Google Play.',
    ],
    iphone: [
      'Ajustes › Privacidad: «Descargar todos mis datos» (gratis) o «Borrar todos mis datos» en este teléfono; confirmas escribiendo BORRAR y no se deshace.',
      'Respaldo en la nube: Ajustes › Respaldo › Borrar cuenta de respaldo. Borrar tus datos no cancela una suscripción: eso se hace en la tienda donde la compraste.',
    ],
  },
  {
    id: 'facturas',
    pregunta: '¿Cómo funcionan las facturas y las deducciones?',
    respuesta: [
      'Comparte el XML de cada factura o un ZIP (portal del SAT o correo) desde Deducciones. Solo leo versión 4.0; todo queda en tu teléfono.',
      'Con Plus, con tu RFC e ingresos del año ves cuánto llevas deducible y qué no cuenta. Si todavía no puede estimar, un contador valida topes y reglas; tus facturas ya quedan guardadas.',
      'Estimación para apartar dinero y preparar tu declaración. No sustituye a tu contador ni presenta declaraciones ante el SAT.',
    ],
  },
];
