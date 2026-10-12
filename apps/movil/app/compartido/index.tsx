import { useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { PantallaCompartidos } from '../../src/pantallas/compartido';

/** Cuentas → Gastos compartidos (`02 §27`). */
export default function CompartidosRuta() {
  const router = useRouter();
  return (
    <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
      <PantallaCompartidos
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
        alAbrirGrupo={(id) => router.replace({ pathname: '/compartido/[id]', params: { id } })}
      />
    </ProveedorCompartido>
  );
}
