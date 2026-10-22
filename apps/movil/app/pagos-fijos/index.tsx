import { useRouter } from 'expo-router';
import { PantallaPagosFijos } from '../../src/pantallas/cuentas';

/** Cuentas › Compromisos › todos tus pagos fijos (`02 §11`). */
export default function PagosFijosRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <PantallaPagosFijos
      alVolver={volver}
      alAgregar={() => router.push('/pagos-fijos/nuevo')}
      alAbrir={(id) => router.push({ pathname: '/pagos-fijos/[id]', params: { id } })}
    />
  );
}
