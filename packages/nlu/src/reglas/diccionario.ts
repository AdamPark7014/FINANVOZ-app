import type { Categoria } from '../esquema';

/**
 * Diccionario semilla de categorías (docs/06-NLU.md §3.1), en minúsculas y sin acentos (la ñ se conserva).
 * Quedan fuera a propósito, por ambiguas: gas, chelas, pastel, celular, mantenimiento (ver `CONOCIDAS_SIN_CATEGORIA`).
 * Las entradas de varias palabras con artículo o preposición ("corte de pelo", "el agua") no aplican en el nivel 0,
 * porque su `DESC` no admite esas palabras.
 * Ampliado el 26-10-2026 con palabras de un solo sentido (plurales, platillos, marcas de servicio): más frases se
 * resuelven en el teléfono, sin red ni costo. Nada de nombres de tiendas que venden de todo (Walmart, Oxxo): esos son
 * COMERCIO y la categoría sale de lo que se compró.
 */
const DICCIONARIO: Readonly<Partial<Record<Categoria, readonly string[]>>> = {
  comida_fuera: [
    'tacos',
    'taco',
    'torta',
    'tortas',
    'comida',
    'cena',
    'desayuno',
    'almuerzo',
    'restaurante',
    'fonda',
    'garnachas',
    'pizza',
    'pizzas',
    'hamburguesa',
    'hamburguesas',
    'sushi',
    'ramen',
    'quesadilla',
    'quesadillas',
    'tamal',
    'tamales',
    'pozole',
    'birria',
    'gorditas',
    'sopes',
    'tlayudas',
    'chilaquiles',
    'enchiladas',
    'flautas',
    'huaraches',
    'pambazos',
    'tlacoyos',
    'molletes',
    'cemitas',
    'mariscos',
    'carnitas',
    'barbacoa',
    'burritos',
    'alitas',
  ],
  antojos: [
    'coca',
    'refresco',
    'refrescos',
    'cafe',
    'cafecito',
    'frappe',
    'malteada',
    'chicle',
    'botana',
    'papas',
    'palomitas',
    'chicharrones',
    'dulces',
    'gomitas',
    'chocolate',
    'chocolates',
    'galletas',
    'donas',
    'churros',
    'helado',
    'helados',
    'nieve',
    'paleta',
    'paletas',
    'raspado',
    'elote',
    'esquite',
  ],
  super: [
    'super',
    'despensa',
    'mandado',
    'mercado',
    'abarrotes',
    'verdura',
    'verduras',
    'fruta',
    'frutas',
    'carne',
    'carniceria',
    'tortillas',
    'tortilleria',
    'leche',
  ],
  transporte: [
    'uber',
    'ubers',
    'didi',
    'taxi',
    'taxis',
    'camion',
    'autobus',
    'metro',
    'metrobus',
    'tren',
    'pasaje',
    'pasajes',
    'estacionamiento',
    'parquimetro',
    'caseta',
    'peaje',
    'combi',
  ],
  gasolina: ['gasolina', 'diesel', 'magna', 'premium'],
  servicios: [
    'luz',
    'cfe',
    'internet',
    'cable',
    'recarga',
    'recargas',
    'telefono',
    'telmex',
    'telcel',
    'izzi',
    'totalplay',
    'megacable',
  ],
  vivienda: ['renta', 'hipoteca'],
  salud: [
    'farmacia',
    'medicinas',
    'medicina',
    'medicamentos',
    'pastillas',
    'vitaminas',
    'doctor',
    'doctora',
    'medico',
    'medica',
    'consulta',
    'dentista',
    'pediatra',
    'ginecologo',
    'ginecologa',
    'oculista',
    'psicologo',
    'psicologa',
    'terapia',
    'vacuna',
    'vacunas',
    'laboratorio',
    'analisis',
    'ultrasonido',
    'radiografia',
    'hospital',
  ],
  educacion: [
    'colegiatura',
    'colegiaturas',
    'inscripcion',
    'escuela',
    'universidad',
    'diplomado',
    'libros',
    'cuaderno',
    'cuadernos',
    'utiles',
    'curso',
  ],
  entretenimiento: [
    'cine',
    'concierto',
    'boletos',
    'antro',
    'teatro',
    'museo',
    'boliche',
    'karaoke',
    'videojuego',
    'videojuegos',
  ],
  suscripciones: [
    'netflix',
    'spotify',
    'disney',
    'max',
    'hbo',
    'paramount',
    'crunchyroll',
    'prime',
    'youtube premium',
    'icloud',
  ],
  ropa: [
    'tenis',
    'ropa',
    'chamarra',
    'sudadera',
    'playera',
    'playeras',
    'camisa',
    'camisas',
    'blusa',
    'vestido',
    'falda',
    'pantalon',
    'pantalones',
    'jeans',
    'pants',
    'calcetines',
    'gorra',
    'zapatos',
  ],
  cuidado_personal: [
    'peluqueria',
    'barberia',
    'estetica',
    'uñas',
    'manicure',
    'pedicure',
    'shampoo',
    'desodorante',
    'maquillaje',
    'perfume',
  ],
  mascotas: ['croquetas', 'veterinario', 'veterinaria'],
  deporte: ['gimnasio', 'gym', 'crossfit', 'yoga', 'pilates'],
  regalos: ['regalo', 'regalos'],
  tecnologia: [
    'audifonos',
    'cargador',
    'tele',
    'television',
    'pantalla',
    'laptop',
    'computadora',
    'tablet',
    'impresora',
    'bocina',
  ],
  hogar: [
    'muebles',
    'sillon',
    'sabanas',
    'cobija',
    'cortinas',
    'focos',
    'ferreteria',
    'lavadora',
    'refri',
    'refrigerador',
    'estufa',
    'licuadora',
    'microondas',
  ],
};

/**
 * Cosas que sin duda se compraron pero cuya categoría es ambigua (06 §3.1): "unas chelas, 340" es un gasto sin
 * categoría, igual que "gas" (LP o gasolina), "pastel", "celular" (equipo o plan), "propina" o "enganche". Cuentan
 * como DESC_CONOCIDA (la frase sin verbo se entiende) pero nunca ponen categoría ni sirven para consultas.
 */
export const CONOCIDAS_SIN_CATEGORIA: ReadonlySet<string> = new Set([
  'chela',
  'chelas',
  'cerveza',
  'cervezas',
  'caguama',
  'caguamas',
  'pastel',
  'gas',
  'celular',
  'propina',
  'enganche',
  'pan',
  'pollo',
  'jugo',
]);

/** Destinatarios que vuelven la compra de la mascota: "comida para el perro", "consulta del gato" → mascotas. */
export const MASCOTAS_DESTINO: ReadonlySet<string> = new Set([
  'perro',
  'perros',
  'perrito',
  'perritos',
  'perrita',
  'gato',
  'gatos',
  'gatito',
  'gatitos',
  'gatita',
  'mascota',
  'mascotas',
]);

/**
 * Parentescos: el dinero que se le pasa o se le da a un familiar es `apoyo_familiar` (06 §3.1, igual que el prompt
 * de la nube: "jefa" y "jefe" son mamá y papá).
 */
export const FAMILIA: ReadonlySet<string> = new Set([
  'mama',
  'mami',
  'madre',
  'jefa',
  'jefita',
  'papa',
  'papi',
  'padre',
  'jefe',
  'jefecito',
  'hermano',
  'hermana',
  'hermanito',
  'hermanita',
  'abuela',
  'abuelo',
  'abuelita',
  'abuelito',
  'hijo',
  'hija',
  'tio',
  'tia',
  'sobrino',
  'sobrina',
  'primo',
  'prima',
  'suegra',
  'suegro',
  'nieto',
  'nieta',
  'cuñado',
  'cuñada',
]);

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

/** Todas las palabras son del diccionario o de `CONOCIDAS_SIN_CATEGORIA` (DESC_CONOCIDA). */
export function sonConocidas(palabras: readonly string[]): boolean {
  if (palabras.length === 0) return false;
  const { cubiertas } = buscarEnDiccionario(palabras);
  return palabras.every((p, i) => cubiertas[i] === true || CONOCIDAS_SIN_CATEGORIA.has(p));
}
