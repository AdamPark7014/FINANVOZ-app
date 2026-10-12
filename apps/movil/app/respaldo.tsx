import { useRouter } from 'expo-router';
import { PantallaRespaldo } from '../src/pantallas/respaldo/PantallaRespaldo';
import { Pantalla } from '../src/ui';

/** Ajustes → Respaldo (M9, `02 §19`). */
export default function Respaldo() {
  const router = useRouter();
  return (
    <Pantalla testID="respaldo" bordes={['top', 'left', 'right', 'bottom']}>
      <PantallaRespaldo alVolver={() => router.back()} alRestaurar={() => router.push('/restaurar')} />
    </Pantalla>
  );
}
