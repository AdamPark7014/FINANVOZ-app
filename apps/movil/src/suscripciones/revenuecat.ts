import type { EstadoTienda } from '../servicios';
import type { AdaptadorCompras, OfertaPlus, ResultadoCompra } from './tipos';

/** Identificador del derecho de Plus en RevenueCat (el mismo que lee el webhook del proxy). */
export const ENTITLEMENT_PLUS = 'plus';

/** Subconjunto de `CustomerInfo` de `react-native-purchases` que usa la app. */
export interface ClienteRC {
  readonly entitlements: {
    readonly active: Readonly<
      Record<
        string,
        {
          readonly identifier: string;
          readonly isActive: boolean;
          readonly willRenew: boolean;
          readonly periodType: string;
          readonly expirationDate: string | null;
          readonly expirationDateMillis?: number | null;
        }
      >
    >;
  };
}

/** Subconjunto de `PurchasesPackage`. */
export interface PaqueteRC {
  readonly identifier: string;
  readonly packageType: string;
  readonly product: {
    readonly priceString: string;
    readonly defaultOption?: {
      readonly freePhase: {
        readonly billingPeriod: { readonly unit: string; readonly value: number };
      } | null;
    } | null;
  };
}

/**
 * Subconjunto estructural del módulo `react-native-purchases` (10.x). Las pruebas pasan uno falso; el teléfono,
 * el real (`expo.ts`).
 */
export interface ModuloPurchases {
  configure(configuracion: { apiKey: string }): void;
  getCustomerInfo(): Promise<ClienteRC>;
  getOfferings(): Promise<{ current: { availablePackages: readonly PaqueteRC[] } | null }>;
  // El paquete se pasa tal como lo devolvió `getOfferings`.
  purchasePackage(paquete: never): Promise<{ customerInfo: ClienteRC }>;
  restorePurchases(): Promise<ClienteRC>;
  logIn(appUserID: string): Promise<{ customerInfo: ClienteRC }>;
  addCustomerInfoUpdateListener(f: (info: ClienteRC) => void): void;
  removeCustomerInfoUpdateListener(f: (info: ClienteRC) => void): boolean;
  showManageSubscriptions(): Promise<void>;
}

/** Códigos de `PURCHASES_ERROR_CODE`. */
const CANCELADA = '1';
const PAGO_PENDIENTE = '20';

const PERIODOS: Partial<Record<string, OfertaPlus['periodo']>> = { MONTHLY: 'mensual', ANNUAL: 'anual' };
const DIAS_POR_UNIDAD: Partial<Record<string, number>> = { DAY: 1, WEEK: 7 };

export function estadoDesdeCliente(info: ClienteRC): EstadoTienda {
  const e = info.entitlements.active[ENTITLEMENT_PLUS];
  if (!e || !e.isActive) return { plus: null };
  const ms = e.expirationDateMillis ?? (e.expirationDate ? Date.parse(e.expirationDate) : null);
  return {
    plus: {
      vigenteHasta: ms !== null && Number.isFinite(ms) ? ms : null,
      enPrueba: e.periodType === 'TRIAL',
      renovara: e.willRenew,
    },
  };
}

function diasPrueba(p: PaqueteRC): number | null {
  const periodo = p.product.defaultOption?.freePhase?.billingPeriod;
  const factor = periodo ? DIAS_POR_UNIDAD[periodo.unit] : undefined;
  return periodo && factor ? periodo.value * factor : null;
}

/**
 * Compras con RevenueCat (`03 §2`). Configura el SDK la primera vez que hace falta. No registra nada: ni el
 * usuario, ni precios, ni errores (regla 9).
 */
export function crearComprasRevenueCat(modulo: ModuloPurchases, llave: string): AdaptadorCompras {
  let configurado = false;
  let paquetes = new Map<string, PaqueteRC>();
  const sdk = () => {
    if (!configurado) {
      modulo.configure({ apiKey: llave });
      configurado = true;
    }
    return modulo;
  };

  async function ofertas(): Promise<OfertaPlus[]> {
    const disponibles = (await sdk().getOfferings()).current?.availablePackages ?? [];
    paquetes = new Map(disponibles.map((p) => [p.identifier, p]));
    return disponibles.flatMap((p): OfertaPlus[] => {
      const periodo = PERIODOS[p.packageType];
      return periodo
        ? [{ id: p.identifier, periodo, precio: p.product.priceString, diasPrueba: diasPrueba(p) }]
        : [];
    });
  }

  return {
    simulada: false,
    async estado() {
      return estadoDesdeCliente(await sdk().getCustomerInfo());
    },
    ofertas,
    async comprar(id): Promise<ResultadoCompra> {
      try {
        if (!paquetes.has(id)) await ofertas();
        const paquete = paquetes.get(id);
        if (!paquete) return { tipo: 'error' };
        const r = await sdk().purchasePackage(paquete as never);
        return { tipo: 'comprado', estado: estadoDesdeCliente(r.customerInfo) };
      } catch (e) {
        const error = (e ?? {}) as { code?: unknown; userCancelled?: unknown };
        if (error.userCancelled === true || error.code === CANCELADA) return { tipo: 'cancelado' };
        if (error.code === PAGO_PENDIENTE) return { tipo: 'pendiente' };
        return { tipo: 'error' };
      }
    },
    async restaurar() {
      return estadoDesdeCliente(await sdk().restorePurchases());
    },
    async identificar(usuarioId) {
      await sdk().logIn(usuarioId);
    },
    alCambiar(f) {
      const oyente = (info: ClienteRC) => f(estadoDesdeCliente(info));
      sdk().addCustomerInfoUpdateListener(oyente);
      return () => {
        modulo.removeCustomerInfoUpdateListener(oyente);
      };
    },
    async administrar() {
      await sdk().showManageSubscriptions();
    },
  };
}
