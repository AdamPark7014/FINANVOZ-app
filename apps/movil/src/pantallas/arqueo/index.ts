import type { Centavos } from '@cartera/core';

export { PantallaArqueo } from './PantallaArqueo';
export {
  ETIQUETA_MONTO_TRAES,
  ETIQUETA_OTRA_CANTIDAD,
  ETIQUETA_QUIEN_TE_PAGO,
  mensajeCuadra,
  TITULO as TITULO_ARQUEO,
  textoDeberiasTraer,
} from './textos';

/**
 * La cantidad de "traigo 300" viaja en memoria, no en la ruta: las rutas pueden terminar en breadcrumbs de
 * errores y ningún monto sale del teléfono (regla 9). La pantalla la toma una vez al abrir.
 */
let efectivoPendiente: Centavos | null = null;

export function tomarEfectivoPendiente(): Centavos | null {
  const v = efectivoPendiente;
  efectivoPendiente = null;
  return v;
}

/** Abre `/arqueo` (opcionalmente de una cuenta de efectivo y con la cantidad dicha). */
export function abrirArqueo(
  router: { push: (ruta: { pathname: '/arqueo'; params?: Record<string, string> }) => void },
  opciones: { efectivoReal?: Centavos; cuentaId?: string } = {},
): void {
  efectivoPendiente = opciones.efectivoReal ?? null;
  router.push({
    pathname: '/arqueo',
    ...(opciones.cuentaId ? { params: { cuenta: opciones.cuentaId } } : {}),
  });
}
