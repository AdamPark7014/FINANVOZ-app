import { Stack, useRouter } from 'expo-router';
import { CentroPrivacidad, TIP_SOLO_LECTURA, TITULO_PRIVACIDAD } from '../src/pantallas/privacidad';
import { enSoloLectura } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { espacio, Pantalla, Texto } from '../src/ui';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Centro de privacidad (RF-PRI-03), desde Ajustes. */
export default function Privacidad() {
  const router = useRouter();
  const control = useControlApp();
  const soloLectura = useVista(enSoloLectura);
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PRIVACIDAD)} />
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
          alLeerAviso={() => router.push('/aviso-privacidad')}
          alLeerTerminos={() => router.push('/terminos')}
          alBorrarTodo={() => control.borrarTodo()}
          alRestaurar={() => router.push('/restaurar')}
        />
      </Pantalla>
    </>
  );
}
