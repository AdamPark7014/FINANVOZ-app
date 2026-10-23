import type { Centavos } from '@cartera/core';
import type { TarjetaPorAgregar } from '../../servicios/config-tarjetas';
import type { PropuestaCuentaDividida, ResultadoTexto } from '../../servicios/registrar';
import type { EntradaTanda } from '../../servicios/tandas';
import type { IdFlujo } from '../tipos';

/** Lo que recibe el formulario de tarjeta nueva (`useFormularioTarjeta({ prellenado })` usa la parte de `TarjetaPorAgregar`). */
export interface PrellenadoTarjeta extends TarjetaPorAgregar {
  readonly nombre: string | null;
  readonly saldo: Centavos | null;
  readonly modo: 'totalero' | 'plan' | null;
  readonly limiteCredito: Centavos | null;
}

/** Qué deja cada flujo al abrir su formulario largo («Cambiar algo»). */
export interface PrellenadosFlujo {
  readonly tarjeta: PrellenadoTarjeta;
  /** Los `datos` de `TarjetaConfirmarMsi`, con lo que se cambió en «Entendí». */
  readonly msi: Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;
  /** Entrada para `proponerTanda(ctx, …)`, cuyo resultado es el `prellenado` de `FormularioTanda`. */
  readonly tanda: EntradaTanda;
  /** El `prellenado` de `FormularioCuentaDividida`. */
  readonly cuenta_dividida: PropuestaCuentaDividida;
  /** Lo que `PantallaArqueo` recibe como `efectivoInicial` (y los gastos que ya se marcaron). */
  readonly arqueo: { readonly efectivoReal: Centavos | null; readonly marcados: readonly string[] };
  /** El `montoSugerido` de `FormularioPago` y la cuenta elegida. */
  readonly pagar_tarjeta: {
    readonly tarjetaId: string | null;
    readonly monto: Centavos | null;
    readonly origenId: string | null;
  };
}

/**
 * Lo dicho viaja en memoria, no en la ruta: las rutas pueden terminar en breadcrumbs de errores y ningún monto,
 * nombre ni alias sale del teléfono (regla 9). `formularioLargo` lo deja aquí y la pantalla del formulario lo toma
 * una sola vez al abrir.
 */
const pendientes = new Map<IdFlujo, unknown>();

export function dejarPrellenado<I extends IdFlujo>(id: I, datos: PrellenadosFlujo[I]): void {
  pendientes.set(id, datos);
}

export function tomarPrellenado<I extends IdFlujo>(id: I): PrellenadosFlujo[I] | null {
  const v = pendientes.get(id);
  pendientes.delete(id);
  return v === undefined ? null : (v as PrellenadosFlujo[I]);
}
