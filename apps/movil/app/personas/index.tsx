import { useRouter } from 'expo-router';
import { PantallaPersonas } from '../../src/pantallas/cuentas';
import { BarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Personas (`02 §17`): todas, cada una abre su ficha. */
export default function PersonasRuta() {
  const router = useRouter();
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <PantallaPersonas alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })} />
    </>
  );
}
