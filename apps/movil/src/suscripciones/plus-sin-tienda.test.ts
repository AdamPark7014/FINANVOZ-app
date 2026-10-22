// «Plus de prueba» sin tienda (decisión reversible del 22-10-2026): `EXPO_PUBLIC_PLUS_SIN_TIENDA` → `app.config.ts`
// → `extra.plusSinTienda` → `ProveedorPlan`. Solo `'1'` lo enciende, nunca sale de `app.json` y con tienda manda la
// tienda.
import { afterEach, describe, expect, it, vi } from 'vitest';
import configurar, { plusSinTienda } from '../../app.config';
import appJson from '../../app.json';
import { leerPlusSinTienda, modoPlusDePrueba } from './config';

const extraDe = () => {
  const c = configurar({ config: {} } as Parameters<typeof configurar>[0]);
  return (c.extra ?? {}) as Record<string, unknown>;
};

describe('app.config.ts · extra.plusSinTienda', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("solo '1' lo enciende", () => {
    expect(plusSinTienda('1')).toBe(true);
    expect(plusSinTienda(' 1 ')).toBe(true);
    for (const v of [undefined, '', '0', 'true', 'si', '11']) expect(plusSinTienda(v)).toBe(false);
  });

  it('con la variable en 1 la build lo trae; sin ella va en false (siempre booleano)', () => {
    vi.stubEnv('EXPO_PUBLIC_PLUS_SIN_TIENDA', '1');
    expect(extraDe().plusSinTienda).toBe(true);
    vi.stubEnv('EXPO_PUBLIC_PLUS_SIN_TIENDA', '');
    expect(extraDe().plusSinTienda).toBe(false);
    vi.stubEnv('EXPO_PUBLIC_PLUS_SIN_TIENDA', 'true');
    expect(extraDe().plusSinTienda).toBe(false);
  });

  it('nunca vive en app.json', () => {
    expect(JSON.stringify(appJson)).not.toMatch(/plusSinTienda|PLUS_SIN_TIENDA/);
  });

  it('versión y build de tienda siguen saliendo de APP_VERSION y APP_BUILD_NUMBER (o de app.json)', () => {
    vi.stubEnv('APP_VERSION', '1.0.1');
    vi.stubEnv('APP_BUILD_NUMBER', '42');
    const c = configurar({ config: {} } as Parameters<typeof configurar>[0]);
    expect(c.version).toBe('1.0.1');
    expect(c.ios?.buildNumber).toBe('42');
    expect(c.android?.versionCode).toBe(42);
    vi.stubEnv('APP_VERSION', '');
    vi.stubEnv('APP_BUILD_NUMBER', '');
    const d = configurar({ config: {} } as Parameters<typeof configurar>[0]);
    expect(d.version).toBe(appJson.expo.version);
    expect(d.ios?.buildNumber).toBe(appJson.expo.ios.buildNumber);
    expect(d.android?.versionCode).toBe(appJson.expo.android.versionCode);
  });

  it('las variables de nube vacías (variables de repositorio sin llenar) no entran en extra', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    const extra = extraDe();
    expect(extra).not.toHaveProperty('supabaseUrl');
    expect(extra).not.toHaveProperty('supabaseAnonKey');
  });
});

describe('leerPlusSinTienda y modoPlusDePrueba', () => {
  it('solo un true en extra cuenta', () => {
    expect(leerPlusSinTienda({ plusSinTienda: true })).toBe(true);
    for (const extra of [undefined, null, {}, { plusSinTienda: 'true' }, { plusSinTienda: 1 }, 'x'])
      expect(leerPlusSinTienda(extra)).toBe(false);
  });

  it('Plus de prueba solo sin tienda: con tienda real manda la tienda aunque la variable siga puesta', () => {
    expect(modoPlusDePrueba({ plusSinTienda: true, hayTienda: false })).toBe(true);
    expect(modoPlusDePrueba({ plusSinTienda: true, hayTienda: true })).toBe(false);
    expect(modoPlusDePrueba({ plusSinTienda: false, hayTienda: false })).toBe(false);
    expect(modoPlusDePrueba({ plusSinTienda: false, hayTienda: true })).toBe(false);
  });
});
