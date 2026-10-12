import { useRouter } from 'expo-router';
import { CentroPrivacidad } from '../src/pantallas/privacidad/CentroPrivacidad';
import { useControlApp } from '../src/sesion/ControlApp';
import { Pantalla } from '../src/ui';

/** Centro de privacidad (RF-PRI-03), desde Ajustes. */
export default function Privacidad() {
  const router = useRouter();
  const control = useControlApp();
  return (
    <Pantalla testID="privacidad" bordes={['top', 'left', 'right', 'bottom']}>
      <CentroPrivacidad
        alVolver={() => router.back()}
        alLeerAviso={() => router.push('/aviso-privacidad')}
        alLeerTerminos={() => router.push('/terminos')}
        alBorrarTodo={() => control.borrarTodo()}
      />
    </Pantalla>
  );
}
