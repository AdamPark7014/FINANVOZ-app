import type { Categoria } from '../esquema';

/**
 * Diccionario semilla de categorías (docs/06-NLU.md §3.1), en minúsculas y sin acentos (la ñ se conserva).
 * Quedan fuera a propósito, por ambiguas: gas, chelas, pastel, celular, mantenimiento.
 * Las entradas de varias palabras con artículo o preposición ("corte de pelo", "el agua") no aplican en el nivel 0,
 * porque su `DESC` no admite esas palabras.
 */
const DICCIONARIO: Readonly<Partial<Record<Categoria, readonly string[]>>> = {
  comida_fuera: [
    'tacos',
    'torta',
    'comida',
    'cena',
    'desayuno',
    'restaurante',
    'fonda',
    'garnachas',
    'pizza',
    'hamburguesa',
    'sushi',
    'quesadillas',
    'tamales',
    'pozole',
    'birria',
  ],
  antojos: [
    'coca',
    'refresco',
    'cafe',
    'chicle',
    'botana',
    'papas',
    'dulces',
    'galletas',
    'helado',
    'nieve',
    'elote',
    'esquite',
  ],
  super: ['super', 'despensa', 'mandado', 'mercado', 'abarrotes', 'verdura', 'fruta', 'carne'],
  transporte: [
    'uber',
    'didi',
    'taxi',
    'camion',
    'metro',
    'metrobus',
    'pasaje',
    'estacionamiento',
    'caseta',
    'combi',
  ],
  gasolina: ['gasolina', 'diesel', 'magna', 'premium'],
  servicios: ['luz', 'internet', 'cable', 'recarga', 'telefono'],
  vivienda: ['renta'],
  salud: ['farmacia', 'medicinas', 'doctor', 'consulta', 'dentista', 'laboratorio'],
  educacion: ['colegiatura', 'inscripcion', 'libros', 'utiles', 'curso'],
  entretenimiento: ['cine', 'concierto', 'boletos', 'antro'],
  suscripciones: ['netflix', 'spotify', 'disney', 'max', 'prime', 'youtube premium', 'icloud'],
  ropa: ['tenis', 'ropa', 'chamarra', 'playera', 'pantalon', 'zapatos'],
  cuidado_personal: ['peluqueria', 'barberia', 'uñas'],
  mascotas: ['croquetas', 'veterinario'],
  deporte: ['gimnasio', 'gym'],
  regalos: ['regalo'],
  tecnologia: ['audifonos', 'cargador'],
};

const ENTRADAS: readonly (readonly [readonly string[], Categoria])[] = Object.entries(DICCIONARIO).flatMap(
  ([categoria, palabras]) => (palabras ?? []).map((p) => [p.split(' '), categoria as Categoria] as const),
);

/**
 * Busca las palabras del diccionario en `palabras` (ya en minúsculas y sin acentos). Las entradas de varias palabras
 * ganan sobre las sueltas que contienen ("youtube premium" es suscripción, no gasolina).
 * Devuelve las categorías encontradas y qué posiciones quedaron cubiertas por alguna entrada.
 */
export function buscarEnDiccionario(palabras: readonly string[]): {
  categorias: Set<Categoria>;
  cubiertas: boolean[];
} {
  const cubiertas = palabras.map(() => false);
  const categorias = new Set<Categoria>();
  const ordenadas = [...ENTRADAS].sort((a, b) => b[0].length - a[0].length);
  for (const [entrada, categoria] of ordenadas) {
    for (let i = 0; i + entrada.length <= palabras.length; i++) {
      const coincide = entrada.every((p, k) => palabras[i + k] === p && !cubiertas[i + k]);
      if (!coincide) continue;
      for (let k = 0; k < entrada.length; k++) cubiertas[i + k] = true;
      categorias.add(categoria);
    }
  }
  return { categorias, cubiertas };
}
