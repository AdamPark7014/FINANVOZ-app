import { useRouter } from 'expo-router';
import { PantallaSuscripciones } from '../src/pantallas/suscripciones';

/** Cuentas → Suscripciones (`02 §20`). */
export default function SuscripcionesRuta() {
  const router = useRouter();
  return (
    <PantallaSuscripciones
      alVolver={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
    />
  );
}
