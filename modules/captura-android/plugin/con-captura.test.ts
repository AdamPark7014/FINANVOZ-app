import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Nodo {
  $?: Record<string, string>;
  [hijo: string]: unknown;
}
interface Manifiesto {
  manifest: {
    $?: Record<string, string>;
    'uses-permission'?: Nodo[];
    queries?: { package?: Nodo[]; intent?: unknown[] }[];
    application?: (Nodo & { service?: Nodo[] })[];
  };
}
interface Plugin {
  agregarCaptura(m: Manifiesto, paquetes: string[]): Manifiesto;
  paquetesDelCatalogo(ruta?: string): string[];
  SERVICIO: string;
}

const plugin = createRequire(import.meta.url)('./con-captura.js') as Plugin;

function manifiestoBase(): Manifiesto {
  return {
    manifest: {
      $: { package: 'com.finanvoz.app' },
      'uses-permission': [
        { $: { 'android:name': 'android.permission.RECORD_AUDIO' } },
        { $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' } },
      ],
      queries: [{ intent: [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }] }] }],
      application: [{ $: { 'android:name': '.MainApplication' }, activity: [] }],
    },
  };
}

describe('config plugin de captura', () => {
  it('declara el servicio con BIND_NOTIFICATION_LISTENER_SERVICE, exportado y con su intent-filter', () => {
    const m = plugin.agregarCaptura(manifiestoBase(), ['com.nu.production']);
    const servicios = m.manifest.application?.[0]?.service ?? [];
    expect(servicios).toEqual([
      {
        $: {
          'android:name': 'com.finanvoz.captura.CapturaListenerService',
          'android:label': '@string/captura_nombre_servicio',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] },
        ],
      },
    ]);
  });

  it('agrega <queries> por paquete sin tocar las existentes y quita QUERY_ALL_PACKAGES', () => {
    const m = plugin.agregarCaptura(manifiestoBase(), ['com.nu.production', 'com.bancomer.mbanking']);
    expect(m.manifest.queries?.[0]?.intent).toBeDefined();
    const paquetes = (m.manifest.queries ?? [])
      .flatMap((q) => q.package ?? [])
      .map((p) => p.$?.['android:name']);
    expect(paquetes).toEqual(['com.nu.production', 'com.bancomer.mbanking']);
    const permisos = (m.manifest['uses-permission'] ?? []).map((u) => u.$?.['android:name']);
    expect(permisos).toEqual(['android.permission.RECORD_AUDIO']);
  });

  it('es idempotente: aplicarlo dos veces no duplica servicio ni paquetes', () => {
    const una = plugin.agregarCaptura(manifiestoBase(), ['com.nu.production']);
    const dos = plugin.agregarCaptura(una, ['com.nu.production']);
    expect(dos.manifest.application?.[0]?.service).toHaveLength(1);
    const paquetes = (dos.manifest.queries ?? []).flatMap((q) => q.package ?? []);
    expect(paquetes).toHaveLength(1);
  });

  it('usa el catálogo embebido: todos sus paquetes y ninguno sintético', () => {
    const catalogo = JSON.parse(
      readFileSync(new URL('../android/src/main/assets/captura.bancos.json', import.meta.url), 'utf8'),
    ) as { bancos: { paquetes_android: string[] }[] };
    const paquetes = plugin.paquetesDelCatalogo();
    expect(paquetes).toEqual(catalogo.bancos.flatMap((b) => b.paquetes_android));
    expect(paquetes.length).toBeGreaterThanOrEqual(6);
    expect(paquetes.some((p) => p.startsWith('mx.ejemplo.'))).toBe(false);
  });

  it('falla si el manifiesto no tiene <application>', () => {
    expect(() => plugin.agregarCaptura({ manifest: {} }, [])).toThrow(/application/);
  });
});
