import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { PantallaArqueo, tomarEfectivoPendiente } from '../src/pantallas/arqueo';

/** Arqueo de efectivo (`02 §7`): desde Hoy, desde Cuentas → Efectivo o diciendo "traigo 300". */
export default function Arqueo() {
  const router = useRouter();
  // Solo el id de la cuenta viaja en la ruta; la cantidad dicha, en memoria (regla 9).
  const { cuenta } = useLocalSearchParams<{ cuenta?: string }>();
  const [inicial] = useState(tomarEfectivoPendiente);
  return (
    <PantallaArqueo
      {...(typeof cuenta === 'string' && cuenta !== '' ? { cuentaId: cuenta } : {})}
      {...(inicial !== null ? { efectivoInicial: inicial } : {})}
      alCerrar={() => (router.canGoBack() ? router.back() : router.navigate('/hoy'))}
    />
  );
}
