import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTarjeta } from '../../src/pantallas/tarjetas';

/** Detalle de una tarjeta (`02 §8`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleTarjetaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <ProveedorAvisos>
      <PantallaTarjeta key={id} tarjetaId={String(id)} alVolver={volver} />
    </ProveedorAvisos>
  );
}
