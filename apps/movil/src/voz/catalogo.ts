import * as Speech from 'expo-speech';
import { AppState } from 'react-native';
import type { VozSistema } from './voces';

/**
 * Voces del teléfono (`Speech.getAvailableVoicesAsync`) con caché: la lista cambia poco (cuando la persona descarga
 * una voz en los ajustes del teléfono), así que se vuelve a pedir al regresar a la app o cada pocos minutos.
 */
const VIGENCIA_MS = 5 * 60_000;

let cache: { voces: readonly VozSistema[]; en: number } | null = null;
let escuchaApp = false;

function vigilarRegreso(): void {
  if (escuchaApp) return;
  escuchaApp = true;
  try {
    // Al volver de Ajustes del iPhone (donde se descarga «Paulina (mejorada)») la lista ya es otra.
    AppState.addEventListener('change', (estado) => {
      if (estado === 'active') cache = null;
    });
  } catch {
    // Sin AppState (pruebas): la vigencia basta.
  }
}

function esVoz(v: unknown): v is VozSistema {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.identifier === 'string' && typeof o.language === 'string';
}

/** Las voces instaladas; `[]` si el módulo no está o falla (entonces se habla con la voz del sistema). */
export async function cargarVoces(forzar = false): Promise<readonly VozSistema[]> {
  vigilarRegreso();
  if (!forzar && cache && cache.voces.length > 0 && Date.now() - cache.en < VIGENCIA_MS) return cache.voces;
  try {
    const lista: unknown = await Speech.getAvailableVoicesAsync();
    const voces = Array.isArray(lista)
      ? lista.filter(esVoz).map((v) => ({
          identifier: v.identifier,
          name: typeof v.name === 'string' ? v.name : v.identifier,
          quality: typeof v.quality === 'string' ? v.quality : 'Default',
          language: v.language,
        }))
      : [];
    cache = { voces, en: Date.now() };
    return voces;
  } catch {
    return cache?.voces ?? [];
  }
}

/** Para pruebas: olvida la lista guardada. */
export function olvidarVoces(): void {
  cache = null;
}

/** ¿Hay internet? (Android elige la voz de red de Google solo así). Sin módulo o con error: no. */
export async function hayInternet(): Promise<boolean> {
  try {
    // Carga perezosa: expo-network es nativo; sin él (pruebas, web) se habla con la voz local.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ver arriba
    const red = require('expo-network') as typeof import('expo-network');
    const e = await red.getNetworkStateAsync();
    return e.isConnected === true && e.isInternetReachable !== false;
  } catch {
    return false;
  }
}
