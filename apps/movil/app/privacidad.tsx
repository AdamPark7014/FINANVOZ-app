import { useRouter } from 'expo-router';
import { CentroPrivacidad, TIP_SOLO_LECTURA } from '../src/pantallas/privacidad';
import { enSoloLectura } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { espacio, Pantalla, Texto } from '../src/ui';

/** Centro de privacidad (RF-PRI-03), desde Ajustes. */
export default function Privacidad() {
  const router = useRouter();
  // Abierta desde un aviso o un enlace no hay a dónde regresar: se va a Hoy.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  const control = useControlApp();
  const soloLectura = useVista(enSoloLectura);
  return (
    <Pantalla
      testID="privacidad"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
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
        alVolver={volver}
        alLeerAviso={() => router.push('/aviso-privacidad')}
        alLeerTerminos={() => router.push('/terminos')}
        alBorrarTodo={() => control.borrarTodo()}
        alRestaurar={() => router.push('/restaurar')}
      />
    </Pantalla>
  );
}
