import { useRouter } from 'expo-router';
import { PantallaCuentas } from '../../src/pantallas/principal';

export default function Cuentas() {
  const router = useRouter();
  return (
    <PantallaCuentas
      alAbrirAjustes={() => router.push('/ajustes')}
      alAbrirTarjeta={(id) => router.push({ pathname: '/tarjetas/[id]', params: { id } })}
      alAgregarTarjeta={() => router.push('/tarjetas/nueva')}
    />
  );
}
