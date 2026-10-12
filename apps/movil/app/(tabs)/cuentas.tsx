import { useRouter } from 'expo-router';
import { PantallaCuentas } from '../../src/pantallas/principal';

export default function Cuentas() {
  const router = useRouter();
  return <PantallaCuentas alAbrirAjustes={() => router.push('/ajustes')} />;
}
