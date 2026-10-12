// RF-PAG-01 · adaptador de RevenueCat con un módulo falso (sin red ni módulo nativo).
import { describe, expect, it, vi } from 'vitest';
import { leerLlaveRevenueCat } from './config';
import { crearComprasEnMemoria } from './memoria';
import {
  crearComprasRevenueCat,
  ENTITLEMENT_PLUS,
  estadoDesdeCliente,
  type ClienteRC,
  type ModuloPurchases,
  type PaqueteRC,
} from './revenuecat';

const DIA = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);

function cliente(plus: Partial<ClienteRC['entitlements']['active'][string]> | null): ClienteRC {
  return {
    entitlements: {
      active: plus
        ? {
            [ENTITLEMENT_PLUS]: {
              identifier: ENTITLEMENT_PLUS,
              isActive: true,
              willRenew: true,
              periodType: 'NORMAL',
              expirationDate: new Date(T0 + 30 * DIA).toISOString(),
              expirationDateMillis: T0 + 30 * DIA,
              ...plus,
            },
          }
        : {},
    },
  };
}

function paquete(
  identifier: string,
  packageType: string,
  priceString: string,
  prueba: { unit: string; value: number } | null,
): PaqueteRC {
  return {
    identifier,
    packageType,
    product: {
      priceString,
      defaultOption: { freePhase: prueba ? { billingPeriod: prueba } : null },
    },
  };
}

function moduloFalso(o: { info?: ClienteRC; paquetes?: PaqueteRC[]; error?: unknown } = {}) {
  let oyente: ((c: ClienteRC) => void) | null = null;
  const info = o.info ?? cliente(null);
  const m = {
    configure: vi.fn(),
    getCustomerInfo: vi.fn(async () => info),
    getOfferings: vi.fn(async () => ({ current: { availablePackages: o.paquetes ?? [] } })),
    purchasePackage: vi.fn(async () => {
      if (o.error) throw o.error;
      return { customerInfo: cliente({ periodType: 'TRIAL', expirationDateMillis: T0 + 14 * DIA }) };
    }),
    restorePurchases: vi.fn(async () => info),
    logIn: vi.fn(async () => ({ customerInfo: info })),
    addCustomerInfoUpdateListener: vi.fn((f: (c: ClienteRC) => void) => {
      oyente = f;
    }),
    removeCustomerInfoUpdateListener: vi.fn(() => {
      oyente = null;
      return true;
    }),
    showManageSubscriptions: vi.fn(async () => undefined),
  } satisfies ModuloPurchases;
  return { m, emitir: (c: ClienteRC) => oyente?.(c) };
}

describe('estadoDesdeCliente', () => {
  it('sin el derecho plus activo: sin Plus', () => {
    expect(estadoDesdeCliente(cliente(null))).toEqual({ plus: null });
    expect(estadoDesdeCliente(cliente({ isActive: false }))).toEqual({ plus: null });
  });

  it('prueba, cancelación y vencimiento desde la tienda', () => {
    expect(estadoDesdeCliente(cliente({ periodType: 'TRIAL', expirationDateMillis: T0 + 14 * DIA }))).toEqual(
      { plus: { vigenteHasta: T0 + 14 * DIA, enPrueba: true, renovara: true } },
    );
    expect(estadoDesdeCliente(cliente({ willRenew: false }))).toMatchObject({
      plus: { enPrueba: false, renovara: false },
    });
    // Solo la fecha en texto (versiones viejas del SDK) y sin vencimiento.
    expect(
      estadoDesdeCliente(cliente({ expirationDateMillis: null, expirationDate: new Date(T0).toISOString() })),
    ).toMatchObject({ plus: { vigenteHasta: T0 } });
    expect(estadoDesdeCliente(cliente({ expirationDateMillis: null, expirationDate: null }))).toMatchObject({
      plus: { vigenteHasta: null },
    });
  });
});

describe('crearComprasRevenueCat', () => {
  it('configura una sola vez con la llave y lee el estado', async () => {
    const { m } = moduloFalso({ info: cliente({}) });
    const c = crearComprasRevenueCat(m, 'goog_prueba123');
    expect(c.simulada).toBe(false);
    await c.estado();
    await c.estado();
    expect(m.configure).toHaveBeenCalledTimes(1);
    expect(m.configure).toHaveBeenCalledWith({ apiKey: 'goog_prueba123' });
    expect((await c.estado()).plus?.renovara).toBe(true);
  });

  it('ofertas: mensual y anual con precio de la tienda y días de prueba si aplica', async () => {
    const { m } = moduloFalso({
      paquetes: [
        paquete('$rc_monthly', 'MONTHLY', '$69.00', { unit: 'DAY', value: 14 }),
        paquete('$rc_annual', 'ANNUAL', '$599.00', { unit: 'WEEK', value: 2 }),
        paquete('$rc_lifetime', 'LIFETIME', '$1,999.00', null),
      ],
    });
    const c = crearComprasRevenueCat(m, 'goog_prueba123');
    expect(await c.ofertas()).toEqual([
      { id: '$rc_monthly', periodo: 'mensual', precio: '$69.00', diasPrueba: 14 },
      { id: '$rc_annual', periodo: 'anual', precio: '$599.00', diasPrueba: 14 },
    ]);
  });

  it('comprar: compra el paquete elegido; cancelar y pago pendiente no son errores', async () => {
    const paquetes = [paquete('$rc_monthly', 'MONTHLY', '$69.00', null)];
    const ok = moduloFalso({ paquetes });
    const c = crearComprasRevenueCat(ok.m, 'goog_prueba123');
    await c.ofertas();
    expect(await c.comprar('$rc_monthly')).toEqual({
      tipo: 'comprado',
      estado: { plus: { vigenteHasta: T0 + 14 * DIA, enPrueba: true, renovara: true } },
    });
    expect(await c.comprar('no-existe')).toEqual({ tipo: 'error' });

    const cancelada = moduloFalso({ paquetes, error: { code: '1', userCancelled: true } });
    const c2 = crearComprasRevenueCat(cancelada.m, 'goog_prueba123');
    expect(await c2.comprar('$rc_monthly')).toEqual({ tipo: 'cancelado' });
    const pendiente = moduloFalso({ paquetes, error: { code: '20' } });
    expect(await crearComprasRevenueCat(pendiente.m, 'goog_x').comprar('$rc_monthly')).toEqual({
      tipo: 'pendiente',
    });
    const falla = moduloFalso({ paquetes, error: new Error('red') });
    expect(await crearComprasRevenueCat(falla.m, 'goog_x').comprar('$rc_monthly')).toEqual({ tipo: 'error' });
  });

  it('identificar, restaurar, administrar y avisos de cambio', async () => {
    const { m, emitir } = moduloFalso({ info: cliente({}) });
    const c = crearComprasRevenueCat(m, 'goog_prueba123');
    await c.identificar('00000000-0000-4000-8000-000000000001');
    expect(m.logIn).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    expect((await c.restaurar()).plus).not.toBeNull();
    await c.administrar();
    expect(m.showManageSubscriptions).toHaveBeenCalled();
    const vistos: unknown[] = [];
    const dejar = c.alCambiar((e) => vistos.push(e));
    emitir(cliente(null));
    dejar();
    emitir(cliente({}));
    expect(vistos).toEqual([{ plus: null }]);
    expect(m.removeCustomerInfoUpdateListener).toHaveBeenCalled();
  });
});

describe('leerLlaveRevenueCat', () => {
  it('de expo.extra o de EXPO_PUBLIC_REVENUECAT_ANDROID_KEY; nada escrito en el código', () => {
    expect(leerLlaveRevenueCat({ revenuecatAndroidKey: ' goog_AbC123 ' }, undefined)).toBe('goog_AbC123');
    expect(leerLlaveRevenueCat(undefined, 'goog_Env456')).toBe('goog_Env456');
    expect(leerLlaveRevenueCat(undefined, undefined)).toBeNull();
    expect(leerLlaveRevenueCat({ revenuecatAndroidKey: '' }, '')).toBeNull();
    // Una llave secreta (sk_) nunca debe ir en la app.
    expect(leerLlaveRevenueCat({ revenuecatAndroidKey: 'sk_secreta' }, undefined)).toBeNull();
  });
});

describe('tienda en memoria (pruebas y desarrollo)', () => {
  it('comprar inicia la prueba de 14 días; cancelar y vencer avisan el cambio', async () => {
    let ahora = T0;
    const t = crearComprasEnMemoria({ ahora: () => ahora });
    const vistos: unknown[] = [];
    t.alCambiar((e) => vistos.push(e.plus?.renovara ?? null));
    const [mensual] = await t.ofertas();
    expect(mensual).toMatchObject({ periodo: 'mensual', diasPrueba: 14 });
    expect(await t.comprar(mensual?.id ?? '')).toMatchObject({
      tipo: 'comprado',
      estado: { plus: { vigenteHasta: T0 + 14 * DIA, enPrueba: true } },
    });
    // La prueba ya se usó.
    expect((await t.ofertas())[0]?.diasPrueba).toBeNull();
    t.cancelar();
    ahora += 15 * DIA;
    t.vencer();
    expect(vistos).toEqual([true, false, null]);
    expect(await t.estado()).toEqual({ plus: null });
  });
});
