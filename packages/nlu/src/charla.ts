/**
 * Charla corta que el asistente contesta en el teléfono, sin intérprete ni nube (docs/06-NLU.md §15): saludos,
 * gracias, despedidas, «ok», «¿cómo estás?», ayuda («¿qué puedes hacer?», «¿qué le puedo preguntar?»), «¿quién
 * eres?», pedir que repita («no entendí», «¿mande?»), una queja («no sirves») y qué es el colchón, lo apartado, lo
 * libre o el pago para no generar intereses. Solo frases completas: «hola, tacos 80» sigue siendo un registro, y la
 * app la prueba después del nivel 0. El texto de cada respuesta vive en la app (`apps/movil/src/asistente/charla.ts`).
 */

export const TIPOS_CHARLA = [
  'saludo',
  'gracias',
  'despedida',
  'afirmacion',
  'estado',
  'ayuda',
  'ayuda_preguntas',
  'quien',
  'repetir',
  'queja',
  'concepto_colchon',
  'concepto_apartado',
  'concepto_libre',
  'concepto_pngi',
] as const;
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
    'buen dia',
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
    'muy bien gracias',
    'sale gracias',
    'gracias por todo',
    'te lo agradezco',
  ],
  despedida: [
    'adios',
    'bye',
    'nos vemos',
    'hasta luego',
    'hasta pronto',
    'hasta manana',
    'chao',
    'ahi nos vemos',
    'gracias adios',
    'gracias bye',
    'gracias nos vemos',
  ],
  afirmacion: [
    'ok',
    'okey',
    'oki',
    'va',
    'sale',
    'orale',
    'perfecto',
    'listo',
    'bien',
    'muy bien',
    'bueno',
    'de acuerdo',
    'entendido',
    'entiendo',
    'ya',
    'ya entendi',
    'ah ok',
    'ah ya',
    'excelente',
    'genial',
    'esta bien',
  ],
  estado: ['como estas', 'que tal estas', 'como te va', 'como has estado', 'como andas', 'que tal te va'],
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
    'como registro un gasto',
    'como anoto un gasto',
    'como le hago',
    'para que sirves',
    'en que me ayudas',
  ],
  ayuda_preguntas: [
    'que le puedo preguntar',
    'que te puedo preguntar',
    'que te pregunto',
    'que preguntas puedo hacer',
    'que preguntas te puedo hacer',
    'que me puedes contestar',
    'que me puedes decir',
  ],
  quien: ['quien eres', 'como te llamas', 'que eres'],
  repetir: [
    'no entendi',
    'no te entendi',
    'no entiendo',
    'como',
    'mande',
    'que',
    'que dijiste',
    'repite',
    'repitelo',
    'repitemelo',
    'me lo repites',
    'puedes repetir',
    'no te oi',
    'no escuche',
    'otra vez por favor',
  ],
  queja: [
    'no sirves',
    'no sirves para nada',
    'no entiendes nada',
    'no me entiendes',
    'eres inutil',
    'que mal',
    'esto no sirve',
    'no funciona',
    'no funcionas',
  ],
  concepto_colchon: [
    'que es el colchon',
    'que es colchon',
    'para que es el colchon',
    'para que sirve el colchon',
    'que significa colchon',
    'y el colchon',
    'y el colchon que es',
  ],
  concepto_apartado: [
    'que es lo apartado',
    'que es apartado',
    'que es el apartado',
    'que significa apartado',
    'que es lo reservado',
    'que es reservado',
    'y lo apartado',
    'y lo reservado',
  ],
  concepto_libre: [
    'que es lo libre',
    'que es libre',
    'que significa libre',
    'que es el dinero libre',
    'y lo libre',
    'y el libre',
  ],
  concepto_pngi: [
    'que es el pago para no generar intereses',
    'que es pago para no generar intereses',
    'que significa pago para no generar intereses',
    'que es el pngi',
    'que es el pago sin intereses',
  ],
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
