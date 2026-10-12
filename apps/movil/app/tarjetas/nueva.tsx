import { useRouter } from 'expo-router';
import { FormularioTarjetaNueva } from '../../src/pantallas/tarjetas';
import { Pantalla, Texto } from '../../src/ui';

/** Cuentas → "Agregar tarjeta": el mismo formulario del onboarding (O4); al guardar abre su detalle. */
export default function NuevaTarjetaRuta() {
  const router = useRouter();
  return (
    <Pantalla testID="pantalla-tarjeta-nueva" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto variante="titulo">Tarjeta de crédito</Texto>
      <FormularioTarjetaNueva
        alGuardar={(t) => router.replace({ pathname: '/tarjetas/[id]', params: { id: t.cuentaId } })}
        alCancelar={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
      />
    </Pantalla>
  );
}
