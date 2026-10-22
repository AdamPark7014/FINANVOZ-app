import { useRouter } from 'expo-router';
import { FormularioCuenta } from '../src/pantallas/cuentas/FormularioCuenta';
import { TITULO_CUENTA_NUEVA } from '../src/pantallas/principal/textos';
import { Pantalla, Texto } from '../src/ui';

/** Cuentas → «Agregar cuenta»: el mismo formulario del onboarding (O4); al guardar vuelve a Cuentas. */
export default function CuentaNuevaRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <Pantalla testID="pantalla-cuenta-nueva" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto variante="titulo" accessibilityRole="header">
        {TITULO_CUENTA_NUEVA}
      </Texto>
      <FormularioCuenta testID="cuenta-nueva" alGuardar={volver} alCancelar={volver} />
    </Pantalla>
  );
}
