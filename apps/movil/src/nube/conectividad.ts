/**
 * Conectividad del teléfono con expo-network (módulo nativo; se valida en el dispositivo). Implementa el puerto
 * `Conectividad` de servicios: "en línea" = conectado y sin evidencia de que internet no responde.
 */
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import type { Conectividad } from '../servicios';

const enLineaSegun = (e: NetworkState) => e.isConnected === true && e.isInternetReachable !== false;

export const conectividadExpo: Conectividad = {
  async enLinea() {
    try {
      return enLineaSegun(await getNetworkStateAsync());
    } catch {
      return false;
    }
  },
  alReconectar(f) {
    let antes: boolean | null = null;
    const suscripcion = addNetworkStateListener((e) => {
      const ahora = enLineaSegun(e);
      if (ahora && antes !== true) f();
      antes = ahora;
    });
    return () => suscripcion.remove();
  },
};
