import { useRouter } from 'expo-router';
import { useIncomingShare, type SharePayload } from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { extraerTextoPdf } from '../src/captura/puente';
import { ImportarCompartidas } from '../src/pantallas/deducciones';
import { leerArchivo, nombreDeUri } from '../src/pantallas/deducciones/expo';
import {
  EsperandoPdf,
  esPdfCompartido,
  LeerEstadoCuenta,
  leePdfEnEsteTelefono,
  PdfNoDisponible,
} from '../src/pantallas/estados-cuenta';
import {
  MENSAJE_COMPARTIR_NO_DISPONIBLE_IOS,
  MENSAJE_LEYENDO_COMPARTIDO,
} from '../src/pantallas/estados-cuenta/textos';
import type { ArchivoCfdi } from '../src/servicios';

type Carga = SharePayload & {
  contentUri?: string | null;
  contentMimeType?: string | null;
  originalName?: string | null;
};

/**
 * Hoja de compartir de Android → Finanvoz: `expo-sharing` abre la app en `finanvoz://expo-sharing` con lo
 * compartido (filtros del plugin en `app.json`). Un PDF es un estado de cuenta (M15, `02 §26`) y se lee en el
 * teléfono; los XML o ZIP son facturas (M12, `02 §24`). Se leen una vez y se limpian. En iPhone la hoja de
 * compartir no está configurada: si se llega aquí, lo dice con "Volver" en vez de quedarse en «Leyendo…».
 */
export default function Compartido() {
  const router = useRouter();
  const volver = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);
  if (!leePdfEnEsteTelefono()) {
    return <PdfNoDisponible alVolver={volver} texto={MENSAJE_COMPARTIR_NO_DISPONIBLE_IOS} />;
  }
  return <CompartidoAndroid volver={volver} />;
}

function CompartidoAndroid({ volver }: { volver: () => void }) {
  const router = useRouter();
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const cargas = useMemo<Carga[]>(
    () => (resolvedSharedPayloads.length > 0 ? resolvedSharedPayloads : sharedPayloads),
    [resolvedSharedPayloads, sharedPayloads],
  );
  // Se decide una sola vez, al terminar de resolver: al limpiar lo compartido, la pantalla no cambia de flujo.
  const [pdf, setPdf] = useState<string | null | undefined>(undefined);
  if (!isResolving && pdf === undefined) {
    const carga = cargas.find((p) => p.shareType !== 'text' && p.shareType !== 'url' && esPdfCompartido(p));
    setPdf(carga ? (carga.contentUri ?? carga.value) : null);
  }

  const listos = useRef<Promise<ArchivoCfdi[]> | null>(null);
  const leer = useCallback(() => {
    listos.current ??= Promise.all(
      cargas
        .filter((p) => p.shareType !== 'text' && p.shareType !== 'url')
        .map((p) => {
          const uri = p.contentUri ?? p.value;
          return leerArchivo(uri, nombreDeUri(uri, p.originalName));
        }),
      // Ya leído, se limpia: si la app vuelve a abrirse, no se importa dos veces.
    ).finally(clearSharedPayloads);
    return listos.current;
  }, [cargas, clearSharedPayloads]);

  const extraer = useCallback(
    // Con contraseña se vuelve a leer la misma URI; lo compartido se limpia desde la primera lectura.
    (contrasena: string | null) => extraerTextoPdf(pdf ?? '', contrasena).finally(clearSharedPayloads),
    [clearSharedPayloads, pdf],
  );

  if (isResolving || pdf === undefined) {
    // Con "Volver" por si lo compartido nunca termina de resolverse.
    return <EsperandoPdf texto={MENSAJE_LEYENDO_COMPARTIDO} alVolver={volver} testID="compartido-leyendo" />;
  }
  if (pdf !== null) {
    return (
      <LeerEstadoCuenta
        extraer={extraer}
        alVerTarjeta={(id) => router.replace({ pathname: '/tarjetas/[id]', params: { id } })}
        alSalir={() => router.replace('/')}
      />
    );
  }
  return <ImportarCompartidas leer={leer} alVerDeducciones={() => router.replace('/deducciones')} />;
}
