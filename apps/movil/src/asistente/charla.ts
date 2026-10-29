/**
 * Charla corta que el asistente contesta en el teléfono, sin intérprete ni nube: saludos, gracias, despedidas, «ok»,
 * «¿cómo estás?», ayuda, «¿quién eres?», pedir que repita, una queja y qué es el colchón, lo apartado, lo libre o el
 * pago para no generar intereses. Antes de esto, «hola» viajaba a la nube para volver como «Eso no lo puedo hacer»
 * (regla de costo del 23-10-2026 y tono de asistente amable). Solo frases completas: «hola, tacos 80» sigue siendo un
 * registro. Qué frase es charla lo decide `leerCharla` (`@cartera/nlu`, medido con su golden de conversaciones); aquí
 * vive el texto de cada respuesta. Ninguna lleva cifras (regla 4) ni consejos (`08 §1`).
 */
import { leerCharla, type TipoCharla } from '@cartera/nlu';

export const RESPUESTA_SALUDO =
  'Hola. Dime un gasto, como «tacos 80 en efectivo», o pregúntame cuánto puedes gastar hoy.';
export const RESPUESTA_GRACIAS = 'Con gusto. Aquí sigo cuando me necesites.';
export const RESPUESTA_AYUDA =
  'Anoto lo que gastas y lo que te pagan, te digo cuánto puedes gastar hoy y te recuerdo tus pagos. Prueba con «gasolina 500 con la Nu», «¿cuánto llevo en comida?» o «traigo 300».';
export const RESPUESTA_QUIEN = 'Soy el asistente de Finanvoz: llevo la cuenta de tu dinero contigo, por voz.';
export const RESPUESTA_DESPEDIDA = 'Hasta luego. Aquí sigo cuando me necesites.';
export const RESPUESTA_AFIRMACION = 'Va. Aquí sigo.';
export const RESPUESTA_ESTADO = 'Bien, gracias. ¿Qué anotamos?';
export const RESPUESTA_AYUDA_PREGUNTAS =
  'Pregúntame «¿cuánto puedo gastar hoy?», «¿cuánto llevo en comida?», «¿qué pago esta semana?» o «¿cuándo me pagan?». Después puedes seguir con «¿y la semana pasada?».';
export const RESPUESTA_QUEJA =
  'Perdón. Prueba así: «tacos 80 en efectivo», o pregúntame «¿cuánto puedo gastar hoy?».';
export const RESPUESTA_COLCHON =
  'El colchón es lo que quieres tener siempre guardado. No lo cuento en lo que puedes gastar.';
export const RESPUESTA_APARTADO =
  'Lo apartado es lo que ya tiene destino antes de tu próximo ingreso: pagos fijos, tarjetas y lo que debes.';
export const RESPUESTA_LIBRE =
  'Lo libre es lo que te queda después de lo apartado y del colchón. Lo reparto entre los días hasta tu ingreso.';
export const RESPUESTA_PNGI =
  'Es lo que pagas antes de la fecha límite para que tu tarjeta no te cobre intereses. Pagando solo el mínimo, sí cobra.';
/** «No entendí» sin una respuesta anterior que repetir. */
export const RESPUESTA_REPETIR_SIN =
  'Te escucho. Dime un gasto, como «coca 25 en efectivo», o pregúntame «¿cuánto puedo gastar hoy?».';
export const PREFIJO_REPETIR = 'Te lo digo otra vez: ';

const RESPUESTAS: Readonly<Record<Exclude<TipoCharla, 'repetir'>, string>> = {
  saludo: RESPUESTA_SALUDO,
  gracias: RESPUESTA_GRACIAS,
  despedida: RESPUESTA_DESPEDIDA,
  afirmacion: RESPUESTA_AFIRMACION,
  estado: RESPUESTA_ESTADO,
  ayuda: RESPUESTA_AYUDA,
  ayuda_preguntas: RESPUESTA_AYUDA_PREGUNTAS,
  quien: RESPUESTA_QUIEN,
  queja: RESPUESTA_QUEJA,
  concepto_colchon: RESPUESTA_COLCHON,
  concepto_apartado: RESPUESTA_APARTADO,
  concepto_libre: RESPUESTA_LIBRE,
  concepto_pngi: RESPUESTA_PNGI,
};

/**
 * La respuesta si la frase completa es charla; `null` si es otra cosa (registro, consulta…). Para «no entendí» o
 * «¿mande?», `ultimaRespuesta` es lo último que dijo el asistente en esta sesión: se repite tal cual.
 */
export function respuestaCharla(frase: string, ultimaRespuesta: string | null = null): string | null {
  const tipo = leerCharla(frase);
  if (tipo === null) return null;
  if (tipo === 'repetir')
    return ultimaRespuesta ? `${PREFIJO_REPETIR}${ultimaRespuesta}` : RESPUESTA_REPETIR_SIN;
  return RESPUESTAS[tipo];
}
