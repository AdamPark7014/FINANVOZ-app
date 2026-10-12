import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { extraerTextoPdf } from '../src/captura/puente';
import { LeerEstadoCuenta } from '../src/pantallas/estados-cuenta';
import { borrarCopia, elegirPdf } from '../src/pantallas/estados-cuenta/expo';
import { Pantalla, Texto } from '../src/ui';

/**
 * Detalle de la tarjeta → "Leer el PDF de tu banco" (`02 §26`): el selector del sistema y la misma pantalla que
 * la hoja de compartir, ya con la tarjeta elegida. Solo el id viaja en la ruta (regla 9).
 */
export default function EstadoCuentaRuta() {
  const router = useRouter();
  const { tarjeta } = useLocalSearchParams<{ tarjeta?: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const pedido = useRef(false);
  const volver = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/cuentas')),
    [router],
  );
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    elegirPdf()
      .then((u) => (u ? setUri(u) : volver()))
      .catch(volver);
  }, [volver]);
  useEffect(() => (uri ? () => borrarCopia(uri) : undefined), [uri]);
  const extraer = useCallback((contrasena: string | null) => extraerTextoPdf(uri ?? '', contrasena), [uri]);
  if (!uri) {
    return (
      <Pantalla bordes={['top', 'left', 'right', 'bottom']}>
        <Texto variante="cuerpo" tono="secundario">
          Elige el PDF de tu estado de cuenta…
        </Texto>
      </Pantalla>
    );
  }
  return (
    <LeerEstadoCuenta
      extraer={extraer}
      tarjetaId={tarjeta ? String(tarjeta) : undefined}
      alVerTarjeta={(id) => router.replace({ pathname: '/tarjetas/[id]', params: { id } })}
      alSalir={volver}
    />
  );
}
