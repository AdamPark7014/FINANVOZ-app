import { useRouter } from 'expo-router';
import { PantallaRespaldo } from '../src/pantallas/respaldo/PantallaRespaldo';
import { espacio, Pantalla } from '../src/ui';
import { BarraNativa } from '../src/ui/navegacion';

/** Ajustes → Respaldo (M9, `02 §19`). */
export default function Respaldo() {
  const router = useRouter();
  return (
    <>
      <BarraNativa salida="/hoy" />
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
