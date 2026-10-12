import type { FiltroMovimientos } from '../../servicios';

/**
 * Parámetros de `/movimientos` (`desde`, `hasta`, `categorias`, `cuenta`, `gastos`): solo fechas, slugs de
 * categoría e id de cuenta; nada de montos ni textos (regla 9).
 */
export type ParamsMovimientos = Record<string, string>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z_]+$/;

/** "Ver movimientos" de una consulta → parámetros de la ruta. */
export function paramsDeFiltro(f: FiltroMovimientos): ParamsMovimientos {
  return {
    ...(f.desde ? { desde: f.desde } : {}),
    ...(f.hasta ? { hasta: f.hasta } : {}),
    ...(f.categorias && f.categorias.length > 0 ? { categorias: f.categorias.join(',') } : {}),
    ...(f.cuentaId ? { cuenta: f.cuentaId } : {}),
    ...(f.soloGastos ? { gastos: '1' } : {}),
  };
}

const uno = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Parámetros de la ruta → filtro de Movimientos; lo que no tenga forma válida se ignora. `null`: sin filtro. */
export function filtroDeParams(
  p: Readonly<Record<string, string | string[] | undefined>>,
): FiltroMovimientos | null {
  const desde = uno(p.desde);
  const hasta = uno(p.hasta);
  const categorias = (uno(p.categorias) ?? '').split(',').filter((c) => SLUG.test(c));
  const cuenta = uno(p.cuenta);
  const filtro: FiltroMovimientos = {
    ...(desde && FECHA.test(desde) ? { desde } : {}),
    ...(hasta && FECHA.test(hasta) ? { hasta } : {}),
    ...(categorias.length > 0 ? { categorias } : {}),
    ...(cuenta ? { cuentaId: cuenta } : {}),
    ...(uno(p.gastos) === '1' ? { soloGastos: true } : {}),
  };
  return Object.keys(filtro).length > 0 ? filtro : null;
}
