import { useRouter } from 'expo-router';
import { PantallaMovimientos } from '../../src/pantallas/principal';

export default function Movimientos() {
  const router = useRouter();
  return (
    <PantallaMovimientos
      alRegistrar={() => router.navigate('/registrar')}
      alRevisar={(id) => router.navigate({ pathname: '/registrar', params: { frase: id } })}
    />
  );
}
