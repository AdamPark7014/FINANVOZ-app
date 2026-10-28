import type { Centavos } from '@cartera/core';
import { interpretarReglas, normalizarAlias, resolverCuenta, type Movimiento } from '@cartera/nlu';
import type { Contexto } from './contexto';
import { listarCategorias } from './cuentas';
import { contextoInterprete, cuentasResolutor } from './registrar';

/**
 * «Voy entendiendo» de «Te escucho» (dirección B+, D2): lo que el nivel 0 ya sacó de la frase a medias. Solo para
 * mostrarlo mientras hablas; no registra nada, no usa la red y nada de esto va a logs (regla 9).
 */
export interface LoEntendido {
  /** La cifra, si ya se entendió. */
  readonly monto: Centavos | null;
  readonly categoria: { readonly slug: string; readonly nombre: string } | null;
  /** La cuenta: `seguro` si el intérprete ya la resolvió; si no, la que empieza como la última palabra («efec…»). */
  readonly cuenta: { readonly nombre: string; readonly seguro: boolean } | null;
  /** La frase va de «¿me alcanza?». */
  readonly meAlcanza: boolean;
}

export const NADA_ENTENDIDO: LoEntendido = { monto: null, categoria: null, cuenta: null, meAlcanza: false };

/** Palabras que se quitan del final para encontrar la frase completa más larga que el nivel 0 entiende. */
const RECORTES = 3;
/** Letras mínimas para adivinar una cuenta por cómo empieza («efe» → Efectivo). */
const MINIMO_PREFIJO = 3;

/**
 * Prepara el intérprete con el contexto de hoy (cuentas, alias y categorías) una sola vez por escucha y devuelve la
 * función que lee cada frase parcial. El nivel 0 corre en el teléfono (`interpretarReglas`), sin red.
 */
export function prepararEntendiendo(ctx: Contexto): (parcial: string) => LoEntendido {
  const cuentas = cuentasResolutor(ctx);
  const contexto = contextoInterprete(ctx, cuentas);
  const categorias = new Map(
    [...listarCategorias(ctx, 'gasto'), ...listarCategorias(ctx, 'ingreso')].map((c) => [c.slug, c.nombre]),
  );
  const nombreDeCuenta = (ref: Movimiento['origen']): string | null => {
    if (!ref) return null;
    const r = resolverCuenta(
      { tipo: ref.tipo, ...(ref.alias !== undefined ? { alias: ref.alias } : {}) },
      cuentas,
    );
    return r.resultado === 'cuenta' ? (cuentas.find((c) => c.id === r.cuenta)?.nombre ?? null) : null;
  };
  /** La cuenta cuyo nombre o alias empieza como `palabra` (una sola), o la de efectivo con «efe…». */
  const cuentaPorPrefijo = (palabra: string): string | null => {
    const p = normalizarAlias(palabra);
    if (p.length < MINIMO_PREFIJO) return null;
    const candidatas = cuentas.filter(
      (c) =>
        [c.nombre, ...c.alias].some((a) => normalizarAlias(a).startsWith(p)) ||
        (c.tipo === 'efectivo' && 'efectivo'.startsWith(p)),
    );
    return candidatas.length === 1 ? (candidatas[0]?.nombre ?? null) : null;
  };

  return (parcial) => {
    const palabras = parcial.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return NADA_ENTENDIDO;
    for (let quitar = 0; quitar <= Math.min(RECORTES, palabras.length - 1); quitar++) {
      const i = interpretarReglas(palabras.slice(0, palabras.length - quitar).join(' '), contexto);
      if (i?.intencion === 'simular') {
        return { monto: i.compra.precio, categoria: null, cuenta: null, meAlcanza: true };
      }
      if (i?.intencion !== 'registrar') continue;
      const m = i.movimientos[0];
      if (!m) continue;
      const slug = m.categoria ?? null;
      const nombre = slug ? categorias.get(slug) : undefined;
      const resuelta = nombreDeCuenta(m.tipo === 'ingreso' ? m.destino : m.origen);
      const ultima = palabras[palabras.length - 1] ?? '';
      const tentativa = resuelta === null ? cuentaPorPrefijo(ultima) : null;
      return {
        monto: m.monto,
        categoria: slug && nombre ? { slug, nombre } : null,
        cuenta: resuelta
          ? { nombre: resuelta, seguro: true }
          : tentativa
            ? { nombre: tentativa, seguro: false }
            : null,
        meAlcanza: false,
      };
    }
    return NADA_ENTENDIDO;
  };
}
