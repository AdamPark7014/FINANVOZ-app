import { Redirect } from 'expo-router';
import { obtenerConsentimiento, onboardingCompletado } from '../src/servicios';
import { useVista } from '../src/sesion/ProveedorSesion';

/**
 * Entrada de la app: sin consentimiento o sin terminar el onboarding va a O1; si no, a Hoy. Las pestañas viven
 * en `app/(tabs)` sin `index` propio, así que "/" siempre pasa por aquí.
 */
export default function Inicio() {
  const listo = useVista((ctx) => obtenerConsentimiento(ctx) !== null && onboardingCompletado(ctx));
  return <Redirect href={listo ? '/hoy' : '/onboarding'} />;
}
