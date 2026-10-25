import { Stack, useRouter } from 'expo-router';
import { PantallaPersonas } from '../../src/pantallas/cuentas';
import { TITULO_PERSONAS } from '../../src/pantallas/cuentas/textos';
import { opcionesBarraNativa } from '../../src/ui/navegacion';

/** Cuentas › Personas (`02 §17`): todas, cada una abre su ficha. */
export default function PersonasRuta() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PERSONAS)} />
      <PantallaPersonas
        alAbrirPersona={(id) => router.push({ pathname: '/persona/[id]', params: { id } })}
      />
    </>
  );
}
