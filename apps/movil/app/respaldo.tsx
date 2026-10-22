import { useRouter } from 'expo-router';
import { PantallaRespaldo } from '../src/pantallas/respaldo/PantallaRespaldo';
import { Pantalla } from '../src/ui';

/** Ajustes → Respaldo (M9, `02 §19`). */
export default function Respaldo() {
  const router = useRouter();
  // Abierta desde un aviso o un enlace no hay a dónde regresar: se va a Hoy.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <Pantalla testID="respaldo" bordes={['top', 'left', 'right', 'bottom']}>
      <PantallaRespaldo alVolver={volver} alRestaurar={() => router.push('/restaurar')} />
    </Pantalla>
  );
}
