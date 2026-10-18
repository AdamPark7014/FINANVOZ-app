import { useRouter } from 'expo-router';
import { CentroPrivacidad } from '../src/pantallas/privacidad/CentroPrivacidad';
import { TIP_SOLO_LECTURA } from '../src/pantallas/privacidad/textos';
import { enSoloLectura } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { Pantalla, Texto } from '../src/ui';

/** Centro de privacidad (RF-PRI-03), desde Ajustes. */
export default function Privacidad() {
  const router = useRouter();
  const control = useControlApp();
  const soloLectura = useVista(enSoloLectura);
  return (
    <Pantalla testID="privacidad" bordes={['top', 'left', 'right', 'bottom']}>
      {soloLectura ? (
        <Texto
          testID="privacidad-solo-lectura-tip"
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
        >
          {TIP_SOLO_LECTURA}
        </Texto>
      ) : null}
      <CentroPrivacidad
        alVolver={() => router.back()}
        alLeerAviso={() => router.push('/aviso-privacidad')}
        alLeerTerminos={() => router.push('/terminos')}
        alBorrarTodo={() => control.borrarTodo()}
        alRestaurar={() => router.push('/restaurar')}
      />
    </Pantalla>
  );
}
