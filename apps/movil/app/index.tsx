import { Redirect } from 'expo-router';
import { obtenerConsentimiento, onboardingCompletado, requiereReconsentimiento } from '../src/servicios';
import { useVista } from '../src/sesion/ProveedorSesion';

/**
 * Entrada de la app: sin consentimiento o sin terminar el onboarding va a O1; aviso desactualizado →
 * reconsentimiento; si no, a Hoy. Las pestañas viven en `app/(tabs)` sin `index` propio, así que "/" siempre
 * pasa por aquí.
 */
export default function Inicio() {
  const destino = useVista((ctx) => {
    if (!obtenerConsentimiento(ctx) || !onboardingCompletado(ctx)) return '/onboarding';
    if (requiereReconsentimiento(ctx)) return '/reconsentimiento';
    return '/hoy';
  });
  return <Redirect href={destino} />;
}
