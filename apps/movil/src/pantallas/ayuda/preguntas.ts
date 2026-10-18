import { LEYENDA_ESTIMACION } from '../../servicios/deducciones';
import { INTERPRETACIONES_NUBE_MES } from '../../servicios/plan';
import { RESPONSABLE } from '../onboarding/aviso';

/**
 * Preguntas frecuentes de la Ayuda (CA-M13-04, `02 §14`). Todavía no hay beta: son las 10 dudas más probables
 * según los flujos de la especificación, escritas con lo que la app hace hoy. Este archivo es el único lugar
 * del contenido: después de la beta se reemplaza por las 10 preguntas reales (pendiente en `docs/ESTADO.md`).
 *
 * Reglas del texto: tuteo, frases cortas, sin signos de exclamación, sin "por favor" ni tecnicismos contables,
 * sin precios (los pone la tienda) y sin prometer lo que la app todavía no hace.
 */
export interface PreguntaFrecuente {
  /** Estable: forma el `testID` y sirve para medir cuál se abre (sin contenido). */
  readonly id: string;
  readonly pregunta: string;
  /** Párrafos cortos. */
  readonly respuesta: readonly string[];
}

/** Correo de contacto: el del responsable en el aviso de privacidad (`08 §2`). */
export const CORREO_AYUDA = RESPONSABLE.correo;

/** Asunto fijo del correo. No lleva datos de la persona ni de su libro: ella escribe lo que quiera contar. */
export const ASUNTO_CORREO_AYUDA = 'Ayuda con Finanvoz';

/** `mailto:` con solo el asunto: sin cuerpo, sin versión, sin identificadores (regla 9). */
export function enlaceCorreoAyuda(): string {
  return `mailto:${CORREO_AYUDA}?subject=${encodeURIComponent(ASUNTO_CORREO_AYUDA)}`;
}

export const PREGUNTAS_FRECUENTES: readonly PreguntaFrecuente[] = [
  {
    id: 'captura',
    pregunta: '¿Cómo anota Finanvoz mis compras sin que las escriba?',
    respuesta: [
      'Leo los avisos de las apps de banco que marques en Ajustes › Captura. Solo esas notificaciones; el resto se ignora en tu teléfono. Todo se procesa aquí, no en nuestros servidores.',
      'Tu banco debe mandar avisos de compras. Lo dudoso va a Por revisar; si dejo de ver tu banco 3 días, te aviso. Por ahora solo Android.',
    ],
  },
  {
    id: 'permisos',
    pregunta: '¿Qué permisos pide la app y para qué?',
    respuesta: [
      'Micrófono mientras mantienes el botón de voz; acceso a notificaciones para la captura (si Android te bloquea, «Permitir ajustes restringidos» en la app); avisos de cortes y arqueos; huella o rostro si activas el bloqueo.',
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
      `Plus: probabilidad de llegar al pago, «¿Me alcanza?», tarjeta del día, meses a 12 meses, preguntas libres, deducciones y ${INTERPRETACIONES_NUBE_MES.plus} frases al mes en internet (Gratis, ${INTERPRETACIONES_NUBE_MES.gratis}).`,
      'Gratis: «hoy puedes», captura, voz, cuentas y tarjetas, avisos, arqueo, respaldo y exportar o borrar datos. Precio y prueba en Ajustes › Plan; cobro en Google Play. Si cancelas, vuelves a Gratis sin perder datos.',
    ],
  },
  {
    id: 'borrar',
    pregunta: '¿Cómo descargo o borro mis datos?',
    respuesta: [
      'Ajustes › Privacidad: «Descargar todos mis datos» (gratis) o «Borrar todos mis datos» en este teléfono; confirmas escribiendo BORRAR y no se deshace.',
      'Respaldo en la nube: Ajustes › Respaldo › Borrar cuenta de respaldo. Borrar datos no cancela Plus; eso es en Google Play.',
    ],
  },
  {
    id: 'facturas',
    pregunta: '¿Cómo funcionan las facturas y las deducciones?',
    respuesta: [
      'Comparte XML de facturas, un ZIP del SAT o impórtalos en Deducciones. Solo versión 4.0 y solo en tu teléfono.',
      'Con Plus, RFC e ingresos del año ves totales deducibles y qué no cuenta. Si aún no puede estimar, un contador revisa topes del año; tus facturas ya quedan guardadas.',
      LEYENDA_ESTIMACION,
    ],
  },
];
