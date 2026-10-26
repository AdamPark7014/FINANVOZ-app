import { useLocalSearchParams } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTanda } from '../../src/pantallas/tandas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Detalle de una tanda (`02 §18`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleTandaRuta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <BarraNativa salida="/tandas" />
      <ProveedorAvisos>
        <PantallaTanda key={id} tandaId={String(id)} />
      </ProveedorAvisos>
    </>
  );
}
