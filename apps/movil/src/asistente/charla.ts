/**
 * Charla corta que el asistente contesta en el teléfono, sin intérprete ni nube: saludos, gracias, «¿qué puedes
 * hacer?» y «¿quién eres?». Antes de esto, «hola» viajaba a la nube para volver como «Eso no lo puedo hacer» (regla de
 * costo del 23-10-2026 y tono de asistente amable). Solo frases completas: «hola, tacos 80» sigue siendo un registro.
 */

export const RESPUESTA_SALUDO =
  'Hola. Dime un gasto, como «tacos 80 en efectivo», o pregúntame cuánto puedes gastar hoy.';
export const RESPUESTA_GRACIAS = 'Con gusto. Aquí sigo cuando me necesites.';
export const RESPUESTA_AYUDA =
  'Anoto lo que gastas y lo que te pagan, te digo cuánto puedes gastar hoy y te recuerdo tus pagos. Prueba con «gasolina 500 con la Nu», «¿cuánto llevo en comida?» o «traigo 300».';
export const RESPUESTA_QUIEN = 'Soy el asistente de Finanvoz: llevo la cuenta de tu dinero contigo, por voz.';

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-zñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SALUDOS = new Set([
  'hola',
  'hola hola',
  'hey',
  'oye',
  'que tal',
  'hola que tal',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'buenas',
  'hola buenos dias',
  'hola buenas tardes',
  'hola buenas noches',
  'que onda',
  'hola asistente',
  'hola finanvoz',
]);
const GRACIAS = new Set([
  'gracias',
  'muchas gracias',
  'ok gracias',
  'va gracias',
  'listo gracias',
  'perfecto gracias',
  'mil gracias',
  'gracias asistente',
]);
const AYUDA = new Set([
  'ayuda',
  'ayudame',
  'que puedes hacer',
  'que sabes hacer',
  'que haces',
  'como funcionas',
  'como funciona',
  'como te uso',
  'que te puedo decir',
  'que te digo',
  'como empiezo',
]);
const QUIEN = new Set(['quien eres', 'como te llamas', 'que eres']);

/** La respuesta si la frase completa es charla; `null` si es otra cosa (registro, consulta…). */
export function respuestaCharla(frase: string): string | null {
  const n = normalizar(frase);
  if (n === '') return null;
  if (SALUDOS.has(n)) return RESPUESTA_SALUDO;
  if (GRACIAS.has(n)) return RESPUESTA_GRACIAS;
  if (AYUDA.has(n)) return RESPUESTA_AYUDA;
  if (QUIEN.has(n)) return RESPUESTA_QUIEN;
  return null;
}
