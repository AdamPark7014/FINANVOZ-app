/**
 * Charla corta que el asistente contesta en el teléfono, sin intérprete ni nube: saludos, gracias, «¿qué puedes
 * hacer?» y «¿quién eres?». Antes de esto, «hola» viajaba a la nube para volver como «Eso no lo puedo hacer» (regla de
 * costo del 23-10-2026 y tono de asistente amable). Solo frases completas: «hola, tacos 80» sigue siendo un registro.
 * Qué frase es charla lo decide `leerCharla` (`@cartera/nlu`, medido con su golden de conversaciones); aquí vive el
 * texto de cada respuesta.
 */
import { leerCharla, type TipoCharla } from '@cartera/nlu';

export const RESPUESTA_SALUDO =
  'Hola. Dime un gasto, como «tacos 80 en efectivo», o pregúntame cuánto puedes gastar hoy.';
export const RESPUESTA_GRACIAS = 'Con gusto. Aquí sigo cuando me necesites.';
export const RESPUESTA_AYUDA =
  'Anoto lo que gastas y lo que te pagan, te digo cuánto puedes gastar hoy y te recuerdo tus pagos. Prueba con «gasolina 500 con la Nu», «¿cuánto llevo en comida?» o «traigo 300».';
export const RESPUESTA_QUIEN = 'Soy el asistente de Finanvoz: llevo la cuenta de tu dinero contigo, por voz.';

const RESPUESTAS: Readonly<Record<TipoCharla, string>> = {
  saludo: RESPUESTA_SALUDO,
  gracias: RESPUESTA_GRACIAS,
  ayuda: RESPUESTA_AYUDA,
  quien: RESPUESTA_QUIEN,
};

/** La respuesta si la frase completa es charla; `null` si es otra cosa (registro, consulta…). */
export function respuestaCharla(frase: string): string | null {
  const tipo = leerCharla(frase);
  return tipo === null ? null : RESPUESTAS[tipo];
}
