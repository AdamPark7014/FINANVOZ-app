import { Stack, useLocalSearchParams } from 'expo-router';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { PantallaTanda } from '../../src/pantallas/tandas';
import { TITULO_TANDAS } from '../../src/pantallas/tandas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Detalle de una tanda (`02 §18`). Solo el id viaja en la ruta (regla 9). */
export default function DetalleTandaRuta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_TANDAS)} />
      <ProveedorAvisos>
        <PantallaTanda key={id} tandaId={String(id)} />
      </ProveedorAvisos>
    </>
  );
}
