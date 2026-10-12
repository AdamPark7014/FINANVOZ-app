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
      'Con los avisos que tu app de banco manda a tu teléfono cuando compras, retiras o transfieres. Lo activas al empezar o en Ajustes › Captura, y eliges qué apps de banco leo: solo te muestro las que reconozco en tu teléfono.',
      'Solo leo las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se guardan. Lo que leo se procesa en tu teléfono y no se envía a nuestros servidores.',
      'Para que funcione, tu app de banco debe tener encendidos sus avisos de compras. Lo que no entienda queda en Movimientos › Por revisar, y si dejo de ver avisos de tu banco por 3 días te lo digo. Por ahora la captura es solo para Android.',
    ],
  },
  {
    id: 'permisos',
    pregunta: '¿Qué permisos pide la app y para qué?',
    respuesta: [
      'Micrófono: para registrar hablando. Solo escucha mientras mantienes el botón.',
      'Acceso a notificaciones: para la captura automática. Si Android no te deja encenderlo, abre la información de la app, toca el menú ⋮ y elige «Permitir ajustes restringidos».',
      'Notificaciones: para avisarte de cortes, fechas límite y arqueos. Huella o rostro: solo si activas el bloqueo de la app.',
      'Todos son opcionales: sin ellos puedes escribir tus movimientos. Los revisas en Ajustes › Privacidad › Revisar permisos en tu teléfono.',
    ],
  },
  {
    id: 'efectivo',
    pregunta: '¿Cómo lleva la app mi efectivo?',
    respuesta: [
      'Tus gastos en efectivo no mandan aviso, así que los dictas o escribes («tacos 80 en efectivo»). Para que no se te escape nada, cada tanto te pido contar lo que traes: es el arqueo.',
      'Te lo pido 48 horas después de que retiras en un cajero o si llevas 3 días o más con gastos en efectivo sin contar. También lo abres cuando quieras en Cuentas › Contar mi efectivo, o diciendo «traigo 300».',
      'Si te falta dinero, reparto la diferencia según tus gastos en efectivo y puedes cambiar el reparto antes de confirmar. Si te sobra, te pregunto de dónde salió y no anoto nada sin tu respuesta.',
    ],
  },
  {
    id: 'tarjetas',
    pregunta: '¿Cómo maneja mis tarjetas de crédito y meses sin intereses?',
    respuesta: [
      'Con el saldo que te dice tu banco, el día de corte y la fecha límite, te muestro cuánto debes, el pago para no generar intereses y cuándo vence. Te aviso 3 días antes de la fecha límite y el día de corte.',
      'Una compra a meses se aparta mes con mes: solo la cuota que vence antes de tu próximo ingreso. Puedes pasar a meses una compra desde su detalle en Movimientos, agregar meses que ya tenías y liquidarlos desde la tarjeta.',
      'Si tu saldo no coincide con el del banco, usa Corregir saldo en la tarjeta. Cuando capturo un cargo de $1,000 o más en tu tarjeta de crédito, te pregunto si fue a meses.',
    ],
  },
  {
    id: 'hoy-puedes',
    pregunta: '¿Cómo calculas mi «hoy puedes»?',
    respuesta: [
      'Sumo lo que tienes en efectivo, débito y billeteras. Le quito lo que ya está comprometido antes de tu próximo ingreso: tus pagos fijos, lo que debes de tus tarjetas, las cuotas de meses que vencen y lo que le debes a otras personas (salvo a quien le apagues «Apartar lo que le debo»). También le quito tu colchón.',
      'Lo que queda es tu dinero libre. Lo divido entre los días que faltan para tu próximo ingreso y lo redondeo hacia abajo, a pesos enteros.',
      'Toca la cifra para ver el desglose. Si me falta un dato o algo es dudoso, cuento de más lo que debes: prefiero quedarme corto a que gastes de más.',
    ],
  },
  {
    id: 'respaldo',
    pregunta: '¿Cómo respaldo mis datos o los paso a otro teléfono?',
    respuesta: [
      'En Ajustes › Respaldo. Puedes guardar tu respaldo en la nube con tu correo, a mano o cada semana de forma automática (solo con Wi-Fi si quieres), o exportar un archivo .cartera y guardarlo donde quieras.',
      'Tu respaldo va cifrado con una contraseña que solo tú conoces. Ni nosotros podemos leerlo: si la olvidas, nadie puede recuperar tu respaldo.',
      'En el teléfono nuevo, instala Finanvoz y toca «¿Vienes de otro teléfono? Restaurar respaldo». Entra con tu correo y tu contraseña, o abre tu archivo. El respaldo es gratis.',
    ],
  },
  {
    id: 'privacidad',
    pregunta: '¿Quién puede ver mis datos?',
    respuesta: [
      'Tus cuentas, saldos y movimientos se guardan cifrados solo en tu teléfono. Nunca salen de ahí, salvo dentro de tu respaldo cifrado si lo activas.',
      'Sí salen las frases que la app no entiende sola, para interpretarlas: van a nuestro servidor y a un proveedor de inteligencia artificial, y no las guardamos. Con Plus, cuando me haces una pregunta libre también van los resultados que necesito para responderte, como totales y nombres cortos de tus cuentas.',
      'Los reportes de errores no llevan montos, comercios, nombres ni lo que dictas, y las estadísticas de uso son opcionales. En Ajustes › Privacidad ves qué sale, a quién y decides.',
    ],
  },
  {
    id: 'plus',
    pregunta: '¿Qué incluye Plus y qué pasa si lo cancelo?',
    respuesta: [
      `Plus agrega la probabilidad de llegar a tu próximo pago, «¿Me alcanza?», la tarjeta del día, tus meses de los próximos 12 meses, respuestas a tus preguntas, deducciones personales y ${INTERPRETACIONES_NUBE_MES.plus} frases al mes interpretadas en internet (en Gratis, ${INTERPRETACIONES_NUBE_MES.gratis}).`,
      'Gratis siempre: tu «hoy puedes», la captura automática, el registro por voz, cuentas y tarjetas sin límite, avisos, arqueo, respaldo y descargar o borrar tus datos.',
      'El precio y la prueba gratis los ves en Ajustes › Plan. El cobro lo hace Google Play y ahí lo cancelas. Si no sigues con Plus, vuelves a Gratis y no pierdes ningún dato.',
    ],
  },
  {
    id: 'borrar',
    pregunta: '¿Cómo descargo o borro mis datos?',
    respuesta: [
      'En Ajustes › Privacidad. «Descargar todos mis datos» te da un archivo con todo, gratis, también si cancelas Plus.',
      '«Borrar todos mis datos» borra de este teléfono tus cuentas, tarjetas, movimientos y ajustes. Te pido escribir BORRAR para confirmar y no se puede deshacer, así que primero descarga lo que quieras conservar.',
      'Si tienes respaldo en la nube, bórralo en Ajustes › Respaldo › Borrar cuenta de respaldo: se borran tus respaldos y tu correo. Borrar tus datos no cancela Plus: eso se hace en Google Play.',
    ],
  },
  {
    id: 'facturas',
    pregunta: '¿Cómo funcionan las facturas y las deducciones?',
    respuesta: [
      'Comparte con Finanvoz los XML de tus facturas, o un ZIP que bajes del portal del SAT o de tu correo, o impórtalos en Cuentas › Deducciones. Leo facturas versión 4.0, y solo se guardan en tu teléfono.',
      'Con Plus, y con tu RFC y tus ingresos del año, te digo cuánto llevas deducible por tipo y cuáles no cuentan y por qué, por ejemplo si lo pagaste en efectivo. Si la app te dice que todavía no puede estimar, es porque un contador está revisando los topes del año: tus facturas ya quedan guardadas.',
      LEYENDA_ESTIMACION,
    ],
  },
];
