import { Stack, useRouter } from 'expo-router';
import { PantallaPagosFijos } from '../../src/pantallas/cuentas';
import { TITULO_PAGOS_FIJOS } from '../../src/pantallas/cuentas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Compromisos › todos tus pagos fijos (`02 §11`). */
export default function PagosFijosRuta() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PAGOS_FIJOS)} />
      <PantallaPagosFijos
        alAgregar={() => router.push('/pagos-fijos/nuevo')}
        alAbrir={(id) => router.push({ pathname: '/pagos-fijos/[id]', params: { id } })}
      />
    </>
  );
}
