import { useRouter } from 'expo-router';
import { ActivarCaptura, DIVULGACION_CAPTURA } from '../../src/pantallas/captura/ActivarCaptura';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';

/**
 * O6 · Captura automática (`02 §3`): la divulgación destacada de `08 §3.1` antes de abrir el ajuste del sistema.
 * Sin el módulo nativo (Expo Go, iPhone) dice que no está disponible y sigue.
 */
export default function Captura() {
  const router = useRouter();
  return (
    <PasoOnboarding testID="onb-captura" paso={6} titulo={DIVULGACION_CAPTURA.titulo}>
      <ActivarCaptura testID="onb-captura" alTerminar={() => router.push('/onboarding/colchon')} />
    </PasoOnboarding>
  );
}
