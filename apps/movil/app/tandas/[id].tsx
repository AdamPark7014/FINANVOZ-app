import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTanda } from '../../src/pantallas/tandas';

/** Detalle de una tanda (`02 §18`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleTandaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/tandas'));
  return (
    <ProveedorAvisos>
      <PantallaTanda key={id} tandaId={String(id)} alVolver={volver} />
    </ProveedorAvisos>
  );
}
