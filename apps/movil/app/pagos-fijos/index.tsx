import { useRouter } from 'expo-router';
import { PantallaPagosFijos } from '../../src/pantallas/cuentas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Compromisos › todos tus pagos fijos (`02 §11`). */
export default function PagosFijosRuta() {
  const router = useRouter();
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <PantallaPagosFijos
        alAgregar={() => router.push('/pagos-fijos/nuevo')}
        alAbrir={(id) => router.push({ pathname: '/pagos-fijos/[id]', params: { id } })}
      />
    </>
  );
}
