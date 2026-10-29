/**
 * Charla corta que el asistente contesta en el teléfono, sin intérprete ni nube (docs/06-NLU.md §15): saludos,
 * gracias, «¿qué puedes hacer?» y «¿quién eres?». Solo frases completas: «hola, tacos 80» sigue siendo un registro.
 * El texto de cada respuesta vive en la app (`apps/movil/src/asistente/charla.ts`).
 */

export const TIPOS_CHARLA = ['saludo', 'gracias', 'ayuda', 'quien'] as const;
export type TipoCharla = (typeof TIPOS_CHARLA)[number];

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-zñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FRASES: Readonly<Record<TipoCharla, readonly string[]>> = {
  saludo: [
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
  ],
  gracias: [
    'gracias',
    'muchas gracias',
    'ok gracias',
    'va gracias',
    'listo gracias',
    'perfecto gracias',
    'mil gracias',
    'gracias asistente',
  ],
  ayuda: [
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
  ],
  quien: ['quien eres', 'como te llamas', 'que eres'],
};

const POR_FRASE = new Map<string, TipoCharla>(
  TIPOS_CHARLA.flatMap((tipo) => FRASES[tipo].map((f) => [f, tipo] as const)),
);

/** El tipo de charla si la frase completa lo es; `null` si es otra cosa (registro, consulta…). */
export function leerCharla(frase: string): TipoCharla | null {
  const n = normalizar(frase);
  if (n === '') return null;
  return POR_FRASE.get(n) ?? null;
}
