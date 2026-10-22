/**
 * Nombres hablados de las categorías del catálogo (`04 §2.3`) para consultas y correcciones: "en comida",
 * "era antojo". Las consultas admiten además los grupos `comida`, `movilidad` y `casa` (`fixtures/nlu/contexto.json`).
 */
import type { Categoria } from '../esquema';
import { GRUPOS_CATEGORIA } from '../esquema';
import { buscarEnDiccionario } from './diccionario';
import type { Lector } from './lector';

type Grupo = (typeof GRUPOS_CATEGORIA)[number];

const NOMBRES: readonly (readonly [readonly string[], Categoria])[] = [
  [['antojo'], 'antojos'],
  [['antojos'], 'antojos'],
  [['super'], 'super'],
  [['despensa'], 'super'],
  [['comida', 'fuera'], 'comida_fuera'],
  [['restaurantes'], 'comida_fuera'],
  [['transporte'], 'transporte'],
  [['transportes'], 'transporte'],
  [['gasolina'], 'gasolina'],
  [['entretenimiento'], 'entretenimiento'],
  [['diversion'], 'entretenimiento'],
  [['ropa'], 'ropa'],
  [['hogar'], 'hogar'],
  [['cuidado', 'personal'], 'cuidado_personal'],
  [['salud'], 'salud'],
  [['mascotas'], 'mascotas'],
  [['mascota'], 'mascotas'],
  [['regalos'], 'regalos'],
  [['regalo'], 'regalos'],
  [['apoyo', 'familiar'], 'apoyo_familiar'],
  [['viajes'], 'viajes'],
  [['viaje'], 'viajes'],
  [['tecnologia'], 'tecnologia'],
  [['deporte'], 'deporte'],
  [['deportes'], 'deporte'],
  [['otros', 'gastos'], 'otros_gastos'],
  [['vivienda'], 'vivienda'],
  [['renta'], 'vivienda'],
  [['servicios'], 'servicios'],
  [['suscripciones'], 'suscripciones'],
  [['suscripcion'], 'suscripciones'],
  [['educacion'], 'educacion'],
  [['escuela'], 'educacion'],
  [['comisiones'], 'comisiones_intereses'],
  [['intereses'], 'comisiones_intereses'],
];

const GRUPOS: readonly (readonly [string, Grupo])[] = [
  ['comida', 'comida'],
  ['movilidad', 'movilidad'],
  ['casa', 'casa'],
];

/** Categoría dicha por su nombre ("antojos", "transporte"); consume lo leído. Para corregir: nunca un grupo. */
export function leerCategoria(l: Lector): Categoria | null {
  if (GRUPOS.some(([nombre]) => nombre === l.ver())) return null;
  for (const [nombre, categoria] of NOMBRES) {
    if (l.secuencia(...nombre)) return categoria;
  }
  const palabra = l.ver();
  if (palabra !== undefined) {
    const { categorias, cubiertas } = buscarEnDiccionario([palabra]);
    const [categoria] = categorias;
    if (cubiertas[0] && categorias.size === 1 && categoria) {
      l.pos++;
      return categoria;
    }
  }
  return null;
}

/** Categoría o grupo para una consulta ("comida" es el grupo); consume lo leído. */
export function leerCategoriaConsulta(l: Lector): Categoria | Grupo | null {
  const palabra = l.ver();
  const grupo = GRUPOS.find(([nombre]) => nombre === palabra);
  if (grupo) {
    l.pos++;
    return grupo[1];
  }
  return leerCategoria(l);
}
