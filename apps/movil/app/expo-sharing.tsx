import { useRouter } from 'expo-router';
import { useIncomingShare, type SharePayload } from 'expo-sharing';
import { useCallback, useRef } from 'react';
import { ImportarCompartidas } from '../src/pantallas/deducciones';
import { leerArchivo, nombreDeUri } from '../src/pantallas/deducciones/expo';
import type { ArchivoCfdi } from '../src/servicios';
import { Pantalla, Texto } from '../src/ui';

/**
 * Hoja de compartir de Android → Finanvoz (M12, `02 §24`): `expo-sharing` abre la app en `finanvoz://expo-sharing`
 * con los XML o ZIP compartidos (filtros del plugin en `app.json`). Se leen una vez, se importan y se limpian.
 */
export default function Compartido() {
  const router = useRouter();
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const listos = useRef<Promise<ArchivoCfdi[]> | null>(null);
  const leer = useCallback(() => {
    const cargas: (SharePayload & { contentUri?: string | null; originalName?: string | null })[] =
      resolvedSharedPayloads.length > 0 ? resolvedSharedPayloads : sharedPayloads;
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
  }, [clearSharedPayloads, resolvedSharedPayloads, sharedPayloads]);
  if (isResolving) {
    return (
      <Pantalla bordes={['top', 'left', 'right', 'bottom']}>
        <Texto variante="cuerpo" tono="secundario">
          Leyendo tus facturas…
        </Texto>
      </Pantalla>
    );
  }
  return <ImportarCompartidas leer={leer} alVerDeducciones={() => router.replace('/deducciones')} />;
}
