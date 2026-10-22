import { useRouter } from 'expo-router';
import { PantallaAyuda } from '../src/pantallas/ayuda';
import { Pantalla } from '../src/ui';

/** Ayuda (CA-M13-04): preguntas frecuentes y correo de contacto, desde Ajustes. */
export default function Ayuda() {
  const router = useRouter();
  return (
    <Pantalla testID="ayuda" bordes={['top', 'left', 'right', 'bottom']}>
      <PantallaAyuda alVolver={() => (router.canGoBack() ? router.back() : router.replace('/ajustes'))} />
    </Pantalla>
  );
}
