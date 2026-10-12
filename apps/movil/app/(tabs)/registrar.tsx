import { useRouter } from 'expo-router';
import { PantallaRegistrar } from '../../src/pantallas/principal';

export default function Registrar() {
  const router = useRouter();
  const cerrar = () => (router.canGoBack() ? router.back() : router.navigate('/hoy'));
  return <PantallaRegistrar alCerrar={cerrar} alConsultarHoy={() => router.navigate('/hoy')} />;
}
