import { Stack, useRouter } from 'expo-router';
import { PantallaRespaldo } from '../src/pantallas/respaldo/PantallaRespaldo';
import { TITULO_RESPALDO } from '../src/pantallas/respaldo/textos';
import { espacio, Pantalla } from '../src/ui';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Ajustes → Respaldo (M9, `02 §19`). */
export default function Respaldo() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_RESPALDO)} />
      <Pantalla
        testID="respaldo"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <PantallaRespaldo alRestaurar={() => router.push('/restaurar')} />
      </Pantalla>
    </>
  );
}
