import { Stack, useRouter } from 'expo-router';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { PantallaCompartidos } from '../../src/pantallas/compartido';
import { TITULO_GASTOS_COMPARTIDOS } from '../../src/pantallas/compartido/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/**
 * Cuentas → Gastos compartidos (`02 §27`). El grupo se abre con `push` (animación de avance) para que el gesto de
 * regresar lleve aquí, y no a Cuentas.
 */
export default function CompartidosRuta() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_GASTOS_COMPARTIDOS)} />
      <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
        <PantallaCompartidos
          alAbrirGrupo={(id) => router.push({ pathname: '/compartido/[id]', params: { id } })}
        />
      </ProveedorCompartido>
    </>
  );
}
