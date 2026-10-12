/** Categorización automática de comercios (`docs/07-CAPTURA.md §6`). */
import { normalizarComercio } from '../comercios';
import { ErrorDominio } from '../errores';
import semilla from './comercios_mx.json';

export interface EntradaCatalogo {
  /** Prefijo ya normalizado con E9.1. */
  readonly prefijo: string;
  readonly tokens: readonly string[];
  /** `categoria_slug` del espacio personal (`docs/04-DATOS.md §2.3`). */
  readonly categoria: string;
}

export type ResultadoCategoria =
  | { readonly categoria: string; readonly fuente: 'usuario' }
  | { readonly categoria: string; readonly fuente: 'semilla'; readonly prefijo: string };

/**
 * Construye un catálogo `{categorias: {slug: [prefijos]}}`. Cada prefijo se normaliza con E9.1 para
 * compararlo con el comercio normalizado (así `7 ELEVEN` queda como `ELEVEN`). Un prefijo vacío tras
 * normalizar o repetido entre categorías invalida el catálogo.
 */
export function construirCatalogo(archivo: {
  readonly categorias: Readonly<Record<string, readonly string[]>>;
}): readonly EntradaCatalogo[] {
  const porPrefijo = new Map<string, EntradaCatalogo>();
  for (const [categoria, prefijos] of Object.entries(archivo.categorias)) {
    for (const crudo of prefijos) {
      const prefijo = normalizarComercio(crudo);
      if (prefijo === '') throw new ErrorDominio('catalogo_invalido', `prefijo vacío en ${categoria}`);
      const previo = porPrefijo.get(prefijo);
      if (previo && previo.categoria !== categoria) {
        throw new ErrorDominio('catalogo_invalido', `prefijo ${prefijo} en dos categorías`);
      }
      porPrefijo.set(prefijo, { prefijo, tokens: prefijo.split(' '), categoria });
    }
  }
  return [...porPrefijo.values()];
}

/** Catálogo semilla de `comercios_mx.json`. */
export const CATALOGO_SEMILLA: readonly EntradaCatalogo[] = construirCatalogo(semilla);

function empiezaCon(tokens: readonly string[], prefijo: readonly string[]): boolean {
  return prefijo.length <= tokens.length && prefijo.every((t, i) => tokens[i] === t);
}

/** Reglas `regla_comercio` del usuario: comercio normalizado → categoría. */
export type ReglasComercio = ReadonlyMap<string, string>;

/**
 * Orden de `07 §6`: (1) regla del usuario para el comercio normalizado exacto; (2) catálogo semilla por el
 * prefijo de tokens más largo; (3) `null`: la tarjeta pregunta y aprende.
 */
export function categorizarComercio(
  comercio: string | null | undefined,
  reglas: ReglasComercio = new Map(),
  catalogo: readonly EntradaCatalogo[] = CATALOGO_SEMILLA,
): ResultadoCategoria | null {
  const normalizado = normalizarComercio(comercio);
  if (normalizado === '') return null;
  const deUsuario = reglas.get(normalizado);
  if (deUsuario !== undefined) return { categoria: deUsuario, fuente: 'usuario' };

  const tokens = normalizado.split(' ');
  let mejor: EntradaCatalogo | null = null;
  for (const e of catalogo) {
    if (empiezaCon(tokens, e.tokens) && (mejor === null || e.tokens.length > mejor.tokens.length)) mejor = e;
  }
  return mejor ? { categoria: mejor.categoria, fuente: 'semilla', prefijo: mejor.prefijo } : null;
}
