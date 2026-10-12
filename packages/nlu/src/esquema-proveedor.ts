/**
 * Proyección del esquema `Interpretacion` que se envía a los proveedores de LLM (docs/06-NLU.md §10.1).
 *
 * Se genera desde Zod (`z.toJSONSchema`) y se simplifica para que quepa en el subconjunto de JSON Schema que
 * acepta cada proveedor:
 * - raíz `{ interpretacion }` (nunca una unión en la raíz);
 * - uniones con `anyOf` y literales como `enum` de un valor (Gemini no acepta `const`);
 * - sin restricciones numéricas, de longitud ni `pattern`: los formatos van en `description`;
 * - `additionalProperties: false` en todos los objetos;
 * - variante `nulable` (todos los campos obligatorios y los opcionales como unión con `null`) para proveedores que
 *   exigen `required` completo (OpenAI estricto); `quitarNulos` deshace esa forma antes de validar con Zod.
 *
 * Zod valida siempre después con el esquema completo: la proyección nunca es más estricta que Zod (prueba de
 * contrato CA-M3-07), salvo `aclarar.parcial`, que es un objeto libre y no se puede expresar con
 * `additionalProperties: false` (decisión en `docs/ESTADO.md`).
 *
 * El JSON generado vive en `services/proxy/supabase/functions/_shared/esquema-proveedor.json`
 * (`pnpm --filter @cartera/nlu generar:proveedor`); una prueba falla si está desactualizado.
 */
import { z } from 'zod';
import { Interpretacion } from './esquema';

export type NodoEsquema = { [clave: string]: unknown };

export type Proveedor = 'anthropic' | 'openai' | 'google';
export const PROVEEDORES: readonly Proveedor[] = ['anthropic', 'openai', 'google'];

/** Variante de la proyección que usa cada adaptador. */
export type VarianteEsquema = 'estandar' | 'nulable';
export const VARIANTE_POR_PROVEEDOR: Record<Proveedor, VarianteEsquema> = {
  anthropic: 'estandar',
  openai: 'nulable',
  google: 'estandar',
};

/**
 * Palabras clave de JSON Schema que acepta cada proveedor en su modo de salida estructurada (documentación pública
 * de cada uno a octubre de 2026). La prueba de contrato exige que la proyección use solo estas.
 * - Anthropic: `output_config.format` / herramientas estrictas (sin restricciones numéricas ni de longitud).
 * - OpenAI: `response_format.json_schema` con `strict: true` (todos los campos en `required`).
 * - Google: `generationConfig.responseJsonSchema` (Gemini; sin `const`).
 */
export const PALABRAS_PERMITIDAS: Record<Proveedor, ReadonlySet<string>> = {
  anthropic: new Set([
    'type',
    'properties',
    'required',
    'additionalProperties',
    'enum',
    'const',
    'anyOf',
    'allOf',
    '$ref',
    '$defs',
    'items',
    'description',
    'title',
    'format',
    'default',
  ]),
  openai: new Set([
    'type',
    'properties',
    'required',
    'additionalProperties',
    'enum',
    'const',
    'anyOf',
    '$ref',
    '$defs',
    'items',
    'description',
    'title',
  ]),
  google: new Set([
    '$id',
    '$defs',
    '$ref',
    '$anchor',
    'type',
    'format',
    'title',
    'description',
    'enum',
    'items',
    'prefixItems',
    'minItems',
    'maxItems',
    'minimum',
    'maximum',
    'anyOf',
    'oneOf',
    'properties',
    'additionalProperties',
    'required',
  ]),
};

/** Campos de dinero (centavos) y de fecha, para describir el formato que ya no expresa la proyección. */
const CAMPOS_DINERO = new Set(['monto', 'precio', 'efectivo_real', 'aportacion']);
const DESCRIPCION_FECHA = "Fecha civil 'YYYY-MM-DD' ya resuelta contra la fecha de referencia.";

const esNodo = (v: unknown): v is NodoEsquema => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Objeto libre (`z.record`): sin `properties` y con `additionalProperties` distinto de `false`. */
const esObjetoLibre = (n: NodoEsquema) =>
  n.type === 'object' && n.properties === undefined && n.additionalProperties !== false;

function describir(n: NodoEsquema, campo: string | undefined): string | undefined {
  if (typeof n.pattern === 'string' && n.pattern.includes('\\d{4}')) return DESCRIPCION_FECHA;
  if (n.type === 'integer') {
    const min = typeof n.minimum === 'number' ? n.minimum : undefined;
    const max = typeof n.maximum === 'number' && n.maximum < Number.MAX_SAFE_INTEGER ? n.maximum : undefined;
    if (campo !== undefined && CAMPOS_DINERO.has(campo)) {
      return min === 0
        ? 'Centavos enteros mayores o iguales a 0 (80 pesos = 8000).'
        : 'Centavos enteros mayores que 0 (80 pesos = 8000).';
    }
    if (min !== undefined && max !== undefined) return `Entero de ${min} a ${max}.`;
    if (min !== undefined) return `Entero mayor o igual a ${min}.`;
  }
  if (n.type === 'string' && typeof n.maxLength === 'number')
    return `Texto de 1 a ${n.maxLength} caracteres.`;
  if (n.type === 'array') {
    const min = typeof n.minItems === 'number' ? n.minItems : undefined;
    const max = typeof n.maxItems === 'number' ? n.maxItems : undefined;
    if (min !== undefined && max !== undefined) return `De ${min} a ${max} elementos.`;
    if (max !== undefined) return `Hasta ${max} elementos.`;
  }
  return undefined;
}

/** Simplifica un nodo de `z.toJSONSchema` al subconjunto común (sin restricciones, `anyOf`, `enum`). */
function proyectar(n: NodoEsquema, campo?: string): NodoEsquema {
  const salida: NodoEsquema = {};
  const descripcion = describir(n, campo);
  if (typeof n.type === 'string') salida.type = n.type;

  if (n.const !== undefined) salida.enum = [n.const];
  if (Array.isArray(n.enum)) salida.enum = n.enum;

  const ramas = (n.oneOf ?? n.anyOf) as unknown;
  if (Array.isArray(ramas)) {
    // Uniones de enums (categoría o grupo) se aplanan en un solo enum.
    const nodos = ramas.filter(esNodo).map((r) => proyectar(r, campo));
    if (nodos.every((r) => Array.isArray(r.enum) && r.type === 'string' && Object.keys(r).length === 2)) {
      salida.type = 'string';
      salida.enum = nodos.flatMap((r) => r.enum as unknown[]);
    } else {
      salida.anyOf = nodos;
    }
  }

  if (n.type === 'object' && esNodo(n.properties)) {
    const propiedades: NodoEsquema = {};
    const requeridos = new Set(Array.isArray(n.required) ? (n.required as string[]) : []);
    for (const [clave, valor] of Object.entries(n.properties)) {
      if (!esNodo(valor)) continue;
      if (esObjetoLibre(valor)) {
        requeridos.delete(clave);
        continue;
      }
      propiedades[clave] = proyectar(valor, clave);
    }
    salida.properties = propiedades;
    salida.required = Object.keys(propiedades).filter((c) => requeridos.has(c));
    salida.additionalProperties = false;
  }

  if (n.type === 'array') {
    if (Array.isArray(n.prefixItems)) {
      // Tupla (`quincenal_dias.dias`): arreglo del tipo de sus elementos; la longitud va en la descripción.
      const primero = n.prefixItems.find(esNodo);
      if (primero) salida.items = proyectar(primero, campo);
      salida.description = `Exactamente ${n.prefixItems.length} elementos.`;
    } else if (esNodo(n.items)) {
      salida.items = proyectar(n.items, campo);
    }
  }

  if (descripcion !== undefined && salida.description === undefined) salida.description = descripcion;
  return salida;
}

/** Proyección estándar: campos opcionales fuera de `required`. */
export function generarEsquemaEstandar(): NodoEsquema {
  const zod = z.toJSONSchema(Interpretacion, { unrepresentable: 'any' }) as NodoEsquema;
  return {
    type: 'object',
    properties: {
      interpretacion: {
        ...proyectar(zod),
        description: 'Interpretación de la frase del usuario (Cartera, docs/06-NLU.md §3).',
      },
    },
    required: ['interpretacion'],
    additionalProperties: false,
  };
}

/** Variante `nulable`: todos los campos en `required` y los opcionales como unión con `null`. */
export function hacerNulable(n: NodoEsquema): NodoEsquema {
  const salida: NodoEsquema = { ...n };
  if (Array.isArray(n.anyOf)) salida.anyOf = n.anyOf.filter(esNodo).map(hacerNulable);
  if (esNodo(n.items)) salida.items = hacerNulable(n.items);
  if (esNodo(n.properties)) {
    const requeridos = new Set(Array.isArray(n.required) ? (n.required as string[]) : []);
    const propiedades: NodoEsquema = {};
    for (const [clave, valor] of Object.entries(n.properties)) {
      if (!esNodo(valor)) continue;
      const nulable = hacerNulable(valor);
      propiedades[clave] = requeridos.has(clave) ? nulable : conNull(nulable);
    }
    salida.properties = propiedades;
    salida.required = Object.keys(propiedades);
  }
  return salida;
}

function conNull(n: NodoEsquema): NodoEsquema {
  const { description, ...resto } = n;
  const ramas = Array.isArray(resto.anyOf) && Object.keys(resto).length === 1 ? resto.anyOf : [resto];
  return {
    anyOf: [...ramas, { type: 'null' }],
    ...(description === undefined ? {} : { description }),
  };
}

export interface EsquemasProveedor {
  estandar: NodoEsquema;
  nulable: NodoEsquema;
}

export function generarEsquemasProveedor(): EsquemasProveedor {
  const estandar = generarEsquemaEstandar();
  return { estandar, nulable: hacerNulable(estandar) };
}

/** Quita recursivamente las propiedades `null` (salida de la variante `nulable`) antes de validar con Zod. */
export function quitarNulos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(quitarNulos);
  if (!esNodo(valor)) return valor;
  const salida: NodoEsquema = {};
  for (const [clave, v] of Object.entries(valor)) {
    if (v === null) continue;
    salida[clave] = quitarNulos(v);
  }
  return salida;
}

/** Todas las palabras clave usadas en un esquema (sin contar nombres de propiedades). */
export function palabrasClave(n: unknown, acumulado = new Set<string>()): Set<string> {
  if (Array.isArray(n)) {
    for (const x of n) palabrasClave(x, acumulado);
    return acumulado;
  }
  if (!esNodo(n)) return acumulado;
  for (const [clave, valor] of Object.entries(n)) {
    acumulado.add(clave);
    if (clave === 'properties' || clave === '$defs') {
      if (esNodo(valor)) for (const hijo of Object.values(valor)) palabrasClave(hijo, acumulado);
    } else if (clave !== 'enum' && clave !== 'const' && clave !== 'required') {
      palabrasClave(valor, acumulado);
    }
  }
  return acumulado;
}

/** Contenido del archivo que consume el proxy (con salto de línea final, formato estable). */
export function serializarEsquemasProveedor(): string {
  const { estandar, nulable } = generarEsquemasProveedor();
  return `${JSON.stringify(
    {
      $comment:
        'Generado por packages/nlu/src/esquema-proveedor.ts (pnpm --filter @cartera/nlu generar:proveedor). No editar a mano.',
      estandar,
      nulable,
    },
    null,
    2,
  )}\n`;
}
