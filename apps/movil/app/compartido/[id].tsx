import { useLocalSearchParams } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { PantallaGrupoCompartido } from '../../src/pantallas/compartido';
import { BarraNativa } from '../../src/ui/navegacion';

/**
 * Detalle de un grupo compartido (`02 §27`). Solo el id del grupo viaja en la ruta (regla 9).
 */
export default function GrupoCompartidoRuta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <BarraNativa salida="/compartido" />
      <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
        <PantallaGrupoCompartido key={id} grupoId={String(id)} />
      </ProveedorCompartido>
    </>
  );
}
