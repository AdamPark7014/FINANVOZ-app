import { useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { PantallaCompartidos } from '../../src/pantallas/compartido';

/**
 * Cuentas → Gastos compartidos (`02 §27`). El grupo se abre con `push` (animación de avance) para que el gesto de
 * regresar y "Volver" del grupo lleven aquí, y no a Cuentas.
 */
export default function CompartidosRuta() {
  const router = useRouter();
  return (
    <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
      <PantallaCompartidos
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
        alAbrirGrupo={(id) => router.push({ pathname: '/compartido/[id]', params: { id } })}
      />
    </ProveedorCompartido>
  );
}
