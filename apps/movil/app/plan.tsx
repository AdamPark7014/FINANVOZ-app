import { useRouter } from 'expo-router';
import { PantallaPlan } from '../src/pantallas/plan';

/** Plan Gratis / Plus (RF-PAG-01): desde Ajustes → Plan o desde un candado "· Plus". */
export default function Plan() {
  const router = useRouter();
  return <PantallaPlan alVolver={() => (router.canGoBack() ? router.back() : router.navigate('/hoy'))} />;
}
