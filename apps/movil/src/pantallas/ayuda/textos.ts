import { LEYENDA_ESTIMACION } from '../../servicios/deducciones';
import { INTERPRETACIONES_NUBE_MES } from '../../servicios/plan';
import { etiquetaHablada } from '../../ui/formato';

export interface PreguntaFrecuente {
  /** Estable: forma el `testID` y sirve para medir cuál se abre (sin contenido). */
  readonly id: string;
  readonly pregunta: string;
  /** Párrafos cortos. */
  readonly respuesta: readonly string[];
}

/**
 * Redacción de Ayuda (CA-M13-04, `02 §14`): tuteo, frases cortas, sin signos de exclamación,
 * sin "por favor" ni tecnicismos contables. Las preguntas frecuentes viven aquí; `preguntas.ts` arma el enlace.
 */

export const ETIQUETA_VOLVER = 'Volver';
/** TalkBack: nombre del botón volver (etiqueta accesible). */
export const ACCESIBILIDAD_VOLVER = 'Volver a ajustes';
/** TalkBack: acción del botón volver (desde Ajustes). */
export const PISTA_VOLVER = 'Regresa a Ajustes';

export const TITULO = 'Ayuda';
export const INTRO = 'Toca una pregunta para ver la respuesta.';
/** Encabezado de la lista desplegable (TalkBack: región antes del contacto). */
export const PREGUNTAS_TITULO = 'Preguntas frecuentes';

/** TalkBack: botón en Ajustes que abre esta pantalla. */
export const PISTA_ABRIR_DESDE_AJUSTES = 'Abre las preguntas frecuentes y el contacto';

/** Indicador visual junto a cada pregunta (oculto a TalkBack). */
export const ICONO_PREGUNTA_CERRADA = '+';
export const ICONO_PREGUNTA_ABIERTA = '−';

/**
 * Bloque Ayuda en Ajustes (`02 §12`). `ajustes/textos.ts` reexporta estos valores
 * como `SECCION_AYUDA`, `TEXTO_AYUDA` y `BTN_AYUDA` (una sola fuente de redacción).
 */
export const SECCION_AJUSTES = TITULO;
export const TEXTO_CARD_AJUSTES =
  'Respuestas a las dudas más comunes y nuestro correo de contacto.';
export const BTN_ABRIR_DESDE_AJUSTES = 'Ver preguntas frecuentes';

/** Alias con los nombres de Ajustes; `ajustes/textos.ts` reexporta desde aquí. */
export const SECCION_AYUDA = SECCION_AJUSTES;
export const TEXTO_AYUDA = TEXTO_CARD_AJUSTES;
export const BTN_AYUDA = BTN_ABRIR_DESDE_AJUSTES;

export const CONTACTO_TITULO = '¿No encontraste tu respuesta?';
export const BTN_ESCRIBIR_CORREO = 'Escribir un correo';
export const PISTA_ESCRIBIR_CORREO = 'Abre tu app de correo; el asunto ya viene listo';
/** TalkBack: nombre del botón de contacto por correo. */
export const ACCESIBILIDAD_ESCRIBIR_CORREO = 'Escribir un correo de ayuda';

/** Asunto fijo del correo. No lleva datos de la persona ni de su libro. */
export const ASUNTO_CORREO_AYUDA = 'Ayuda con Finanvoz';

export function textoCuerpoContacto(correo: string): string {
  return `Escríbenos a ${correo}. Cuéntanos qué pasó; no mandes contraseñas ni datos de tarjetas.`;
}

export function mensajeSinAppCorreo(correo: string): string {
  return `No encontré una app de correo en tu teléfono. Escríbenos desde tu correo a ${correo}.`;
}

/** Pista TalkBack al expandir o cerrar una pregunta frecuente. */
export function pistaPreguntaFrecuente(abierta: boolean): string {
  return abierta ? 'Pliega la respuesta' : 'Despliega la respuesta';
}

/** TalkBack: región de texto al expandir una pregunta (antes del contenido). */
export const ETIQUETA_RESPUESTA = 'Respuesta';

function correoEnPalabras(correo: string): string {
  return correo.replace('@', ' arroba ').replace(/\./g, ' punto ');
}

/** TalkBack: párrafo de la FAQ abierta; el primero lleva el encabezado «Respuesta». */
export function etiquetaAccesibleParrafoRespuesta(parrafo: string, esPrimero: boolean): string {
  const cuerpo = etiquetaHablada(parrafo);
  return esPrimero ? `${ETIQUETA_RESPUESTA}. ${cuerpo}` : cuerpo;
}

/** TalkBack: bloque de contacto con la dirección de correo en palabras (`02 §15`). */
export function etiquetaAccesibleCuerpoContacto(correo: string): string {
  return textoCuerpoContacto(correo).replace(correo, correoEnPalabras(correo));
}

/** TalkBack: aviso cuando no hay app de correo (`02 §15`). */
export function etiquetaAccesibleSinAppCorreo(correo: string): string {
  return mensajeSinAppCorreo(correo).replace(correo, correoEnPalabras(correo));
}

/**
 * Diez dudas probables según los flujos de la especificación (pendiente sustituir tras beta en `docs/ESTADO.md`).
 */
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
      'Comparte el XML de cada factura o un ZIP (portal del SAT o correo) desde Deducciones. Solo leo versión 4.0; todo queda en tu teléfono.',
      'Con Plus, con tu RFC e ingresos del año ves cuánto llevas deducible y qué no cuenta. Si todavía no puede estimar, un contador valida topes y reglas; tus facturas ya quedan guardadas.',
      LEYENDA_ESTIMACION,
    ],
  },
];
