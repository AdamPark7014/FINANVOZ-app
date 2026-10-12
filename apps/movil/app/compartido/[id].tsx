import { useLocalSearchParams, useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { PantallaGrupoCompartido } from '../../src/pantallas/compartido';

/** Detalle de un grupo compartido (`02 §27`). Solo el id del grupo viaja en la ruta (regla 9). */
export default function GrupoCompartidoRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
      <PantallaGrupoCompartido key={id} grupoId={String(id)} alVolver={() => router.replace('/compartido')} />
    </ProveedorCompartido>
  );
}
