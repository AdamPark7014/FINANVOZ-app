import { useRouter } from 'expo-router';
import { CentroPrivacidad } from '../src/pantallas/privacidad/CentroPrivacidad';
import { enSoloLectura } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { Pantalla, Texto } from '../src/ui';

/** Consejo cuando rechazaron el aviso nuevo (pendiente 31): ver y exportar, sin registrar. */
const TIP_SOLO_LECTURA =
  'Estás en solo lectura: puedes ver y exportar tus datos, pero no registrar hasta que aceptes el aviso nuevo al abrir la app.';

/** Centro de privacidad (RF-PRI-03), desde Ajustes. */
export default function Privacidad() {
  const router = useRouter();
  const control = useControlApp();
  const soloLectura = useVista(enSoloLectura);
  return (
    <Pantalla testID="privacidad" bordes={['top', 'left', 'right', 'bottom']}>
      {soloLectura ? (
        <Texto testID="privacidad-solo-lectura-tip" variante="secundario" tono="faltante">
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
