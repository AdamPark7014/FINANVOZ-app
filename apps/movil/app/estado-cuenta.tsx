import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { extraerTextoPdf } from '../src/captura/puente';
import {
  EsperandoPdf,
  LeerEstadoCuenta,
  leePdfEnEsteTelefono,
  PdfNoDisponible,
} from '../src/pantallas/estados-cuenta';
import { MENSAJE_ELEGIR_PDF } from '../src/pantallas/estados-cuenta/textos';
import { borrarCopia, elegirPdf } from '../src/pantallas/estados-cuenta/expo';

/**
 * Detalle de la tarjeta → "Leer el PDF de tu banco" (`02 §26`): el selector del sistema y la misma pantalla que
 * la hoja de compartir, ya con la tarjeta elegida. Solo el id viaja en la ruta (regla 9). En iPhone todavía no
 * hay lector de PDF: lo dice con "Volver" sin abrir el selector.
 */
export default function EstadoCuentaRuta() {
  const router = useRouter();
  const { tarjeta } = useLocalSearchParams<{ tarjeta?: string }>();
  const volver = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/cuentas')),
    [router],
  );
  if (!leePdfEnEsteTelefono()) return <PdfNoDisponible alVolver={volver} />;
  return (
    <ElegirYLeer
      tarjeta={tarjeta}
      volver={volver}
      alVerTarjeta={(id) => router.replace({ pathname: '/tarjetas/[id]', params: { id } })}
    />
  );
}

function ElegirYLeer({
  tarjeta,
  volver,
  alVerTarjeta,
}: {
  tarjeta: string | undefined;
  volver: () => void;
  alVerTarjeta: (id: string) => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const pedido = useRef(false);
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    elegirPdf()
      .then((u) => (u ? setUri(u) : volver()))
      .catch(volver);
  }, [volver]);
  useEffect(() => (uri ? () => borrarCopia(uri) : undefined), [uri]);
  const extraer = useCallback((contrasena: string | null) => extraerTextoPdf(uri ?? '', contrasena), [uri]);
  if (!uri) return <EsperandoPdf texto={MENSAJE_ELEGIR_PDF} alVolver={volver} testID="estado-elegir-pdf" />;
  return (
    <LeerEstadoCuenta
      extraer={extraer}
      tarjetaId={tarjeta ? String(tarjeta) : undefined}
      alVerTarjeta={alVerTarjeta}
      alSalir={volver}
    />
  );
}
