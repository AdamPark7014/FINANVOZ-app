import { useRouter } from 'expo-router';
import { Restaurar } from '../src/pantallas/respaldo/Restaurar';
import { Pantalla } from '../src/ui';

/** Restaurar un respaldo `.cartera` (M9): desde el centro de privacidad o desde la bienvenida (teléfono nuevo). */
export default function RestaurarRespaldo() {
  const router = useRouter();
  return (
    <Pantalla testID="restaurar" bordes={['top', 'left', 'right', 'bottom']}>
      <Restaurar alVolver={() => router.back()} />
    </Pantalla>
  );
}
