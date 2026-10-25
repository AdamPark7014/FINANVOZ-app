import { Stack, useLocalSearchParams } from 'expo-router';
import { PantallaPersona } from '../../src/pantallas/personas';
import { TITULO_PERSONAS } from '../../src/pantallas/cuentas/textos';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Detalle de una persona (`02 §17`): Cobrar, Ya me pagó y recordatorio. Solo el id viaja en la ruta (regla 9). */
export default function DetallePersonaRuta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PERSONAS)} />
      <ProveedorAvisos>
        <PantallaPersona key={id} personaId={String(id)} />
      </ProveedorAvisos>
    </>
  );
}
