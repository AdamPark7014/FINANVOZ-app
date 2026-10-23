import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { tomarPrellenado } from '../src/asistente/flujos';
import { PantallaArqueo, tomarEfectivoPendiente } from '../src/pantallas/arqueo';

/** Arqueo de efectivo (`02 §7`): desde Hoy, desde Cuentas → Efectivo o diciendo "traigo 300". */
export default function Arqueo() {
  const router = useRouter();
  // Solo el id de la cuenta viaja en la ruta; la cantidad dicha, en memoria (regla 9).
  const { cuenta } = useLocalSearchParams<{ cuenta?: string }>();
  // «Cambiar algo» del arqueo por voz deja lo dicho; si no, la cantidad de «traigo 300» de siempre.
  const [inicial] = useState(() => tomarPrellenado('arqueo')?.efectivoReal ?? tomarEfectivoPendiente());
  return (
    <PantallaArqueo
      {...(typeof cuenta === 'string' && cuenta !== '' ? { cuentaId: cuenta } : {})}
      {...(inicial !== null ? { efectivoInicial: inicial } : {})}
      alCerrar={() => (router.canGoBack() ? router.back() : router.navigate('/hoy'))}
    />
  );
}
