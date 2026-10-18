import type { FiltroMovimientos } from '../../servicios';

/**
 * Parámetros de `/movimientos` (`desde`, `hasta`, `categorias`, `cuenta`, `gastos`): solo fechas, slugs de
 * categoría e id de cuenta; nada de montos ni textos (regla 9).
 */
export type ParamsMovimientos = Record<string, string>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z_]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** Tocar el aviso "Registré…" → `/movimientos?detalle=<id>` (solo id, sin montos ni textos). */
export function paramsDeDetalle(transaccionId: string): ParamsMovimientos {
  return { detalle: transaccionId };
}

/** Id de transacción en la ruta; lo que no parece UUID se ignora. */
export function detalleDeParams(
  p: Readonly<Record<string, string | string[] | undefined>>,
): string | null {
  const v = uno(p.detalle);
  return v && UUID.test(v) ? v : null;
}

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
