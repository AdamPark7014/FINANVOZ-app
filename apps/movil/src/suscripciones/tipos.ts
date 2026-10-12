import type { EstadoTienda } from '../servicios';

/**
 * Puerto de compras (RF-PAG-01). En el teléfono lo implementa RevenueCat (`revenuecat.ts`); en las pruebas y en
 * builds de desarrollo sin llave, una tienda en memoria (`memoria.ts`). La app nunca ve tarjetas ni datos de pago:
 * la compra la hace la tienda.
 */
export interface AdaptadorCompras {
  /** `true` si es la tienda simulada de desarrollo (la UI lo dice). */
  readonly simulada: boolean;
  /** Lo que la tienda sabe hoy del derecho Plus. Rechaza sin red o si la tienda falla. */
  estado(): Promise<EstadoTienda>;
  /** Planes a la venta (mensual y anual) con el precio que muestra la tienda. */
  ofertas(): Promise<readonly OfertaPlus[]>;
  comprar(ofertaId: string): Promise<ResultadoCompra>;
  /** "Restaurar compras": vuelve a pedir a la tienda las compras de esta cuenta de Google. */
  restaurar(): Promise<EstadoTienda>;
  /** Asocia las compras al usuario anónimo de Supabase (así el webhook actualiza el mismo usuario del proxy). */
  identificar(usuarioId: string): Promise<void>;
  /** Avisa cada cambio del derecho (renovación, cancelación, vencimiento). Devuelve cómo dejar de oír. */
  alCambiar(f: (estado: EstadoTienda) => void): () => void;
  /** Abre la pantalla de suscripciones de la tienda (cancelar, cambiar de plan). */
  administrar(): Promise<void>;
}

export interface OfertaPlus {
  readonly id: string;
  readonly periodo: 'mensual' | 'anual';
  /** Precio con formato de la tienda ("$69.00"). Nunca se calcula con él. */
  readonly precio: string;
  /** Días de prueba gratis si la cuenta todavía puede usarla; `null` si ya la usó o la oferta no tiene. */
  readonly diasPrueba: number | null;
}

export type ResultadoCompra =
  | { readonly tipo: 'comprado'; readonly estado: EstadoTienda }
  /** La persona cerró la hoja de pago. */
  | { readonly tipo: 'cancelado' }
  /** Google Play dejó el pago pendiente (p. ej. efectivo en tienda). */
  | { readonly tipo: 'pendiente' }
  | { readonly tipo: 'error' };
