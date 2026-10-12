import { useLocalSearchParams, useRouter } from 'expo-router';
import { PantallaPersona } from '../../src/pantallas/personas';
import { ProveedorAvisos } from '../../src/pantallas/principal';

/** Detalle de una persona (`02 §17`): Cobrar, Ya me pagó y recordatorio. Solo el id viaja en la ruta (regla 9). */
export default function DetallePersonaRuta() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <ProveedorAvisos>
      <PantallaPersona key={id} personaId={String(id)} alVolver={volver} />
    </ProveedorAvisos>
  );
}
