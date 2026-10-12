import type { Espacio } from './esquema';
import { normalizarAlias } from './normalizar';
import { jaroWinkler } from '@cartera/core';

/** Tipo de cuenta propia. `billetera` cuenta como débito para el resolutor (§5, paso 1). */
export type TipoCuenta = 'efectivo' | 'debito' | 'credito' | 'billetera';

export interface CuentaResolutor {
  id: string;
  tipo: TipoCuenta;
  nombre: string;
  alias: readonly string[];
  espacio?: Espacio;
}

export interface RefResolutor {
  tipo: 'efectivo' | 'debito' | 'credito' | 'tarjeta' | 'desconocido';
  alias?: string;
  /** Espacio del movimiento; por omisión `personal`. */
  espacio?: Espacio;
}

export type ResultadoResolutor =
  | { resultado: 'cuenta'; cuenta: string; aproximado?: true }
  | { resultado: 'ambigua'; candidatas: string[] }
  | { resultado: 'no_encontrada' }
  | { resultado: 'por_asignar' };

export const UMBRAL_ALIAS_DIFUSO = 0.92;

const COMPATIBLES: Record<RefResolutor['tipo'], readonly TipoCuenta[]> = {
  efectivo: ['efectivo'],
  debito: ['debito', 'billetera'],
  credito: ['credito'],
  tarjeta: ['debito', 'billetera', 'credito'],
  desconocido: ['efectivo', 'debito', 'billetera', 'credito'],
};

const compararTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const idsOrdenados = (cuentas: readonly CuentaResolutor[]) => cuentas.map((c) => c.id).sort(compararTexto);
const espacioDe = (c: CuentaResolutor): Espacio => c.espacio ?? 'personal';

/** `resolverCuenta(ref, cuentas)` (docs/06-NLU.md §5). */
export function resolverCuenta(ref: RefResolutor, cuentas: readonly CuentaResolutor[]): ResultadoResolutor {
  const compatibles = COMPATIBLES[ref.tipo];
  const espacio = ref.espacio ?? 'personal';
  const alias = ref.alias === undefined ? '' : normalizarAlias(ref.alias);

  if (alias !== '') {
    // Con alias se busca en las cuentas de todos los espacios.
    const candidatas = cuentas.filter((c) => compatibles.includes(c.tipo));
    let exactas = candidatas.filter(
      (c) => c.alias.some((x) => normalizarAlias(x) === alias) || normalizarAlias(c.nombre) === alias,
    );
    if (exactas.length > 1) {
      // El mismo alias en dos espacios: gana el del movimiento.
      const delEspacio = exactas.filter((c) => espacioDe(c) === espacio);
      if (delEspacio.length === 1) exactas = delEspacio;
    }
    const [unica] = exactas;
    if (exactas.length === 1 && unica) return { resultado: 'cuenta', cuenta: unica.id };
    if (exactas.length > 1) return { resultado: 'ambigua', candidatas: idsOrdenados(exactas) };

    const buscado = alias.toUpperCase();
    const puntajes = candidatas
      .map((c) => ({
        id: c.id,
        puntaje: Math.max(0, ...c.alias.map((x) => jaroWinkler(buscado, normalizarAlias(x).toUpperCase()))),
      }))
      .sort((a, b) => b.puntaje - a.puntaje);
    const [mejor, segundo] = puntajes;
    if (mejor && mejor.puntaje >= UMBRAL_ALIAS_DIFUSO && (!segundo || segundo.puntaje < mejor.puntaje)) {
      return { resultado: 'cuenta', cuenta: mejor.id, aproximado: true };
    }
    return { resultado: 'no_encontrada' };
  }

  // Sin alias, solo las cuentas del espacio del movimiento: la caja del negocio no compite con la cartera.
  if (ref.tipo === 'desconocido') return { resultado: 'por_asignar' };
  const candidatas = cuentas.filter((c) => compatibles.includes(c.tipo) && espacioDe(c) === espacio);
  const [unica] = candidatas;
  if (candidatas.length === 1 && unica) return { resultado: 'cuenta', cuenta: unica.id };
  if (candidatas.length === 0) return { resultado: 'no_encontrada' };
  return { resultado: 'ambigua', candidatas: idsOrdenados(candidatas) };
}
