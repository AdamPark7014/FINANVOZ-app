import { useRouter } from 'expo-router';
import { PantallaDeducciones } from '../src/pantallas/deducciones';
import { archivosFacturasExpo } from '../src/pantallas/deducciones/expo';

/** Personal → Deducciones (`02 §24`): desde Cuentas y desde "Ver mis deducciones" al importar. */
export default function DeduccionesRuta() {
  const router = useRouter();
  return (
    <PantallaDeducciones
      archivos={archivosFacturasExpo}
      alVolver={() => (router.canGoBack() ? router.back() : router.replace('/cuentas'))}
    />
  );
}
