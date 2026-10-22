import { useRouter } from 'expo-router';
import { PantallaPersonas } from '../../src/pantallas/cuentas';

/** Cuentas › Personas (`02 §17`): todas, cada una abre su ficha. */
export default function PersonasRuta() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuentas'));
  return (
    <PantallaPersonas
      alVolver={volver}
      alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })}
    />
  );
}
