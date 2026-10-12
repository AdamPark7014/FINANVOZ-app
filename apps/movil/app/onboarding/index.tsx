import { useRouter } from 'expo-router';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import { obtenerConsentimiento } from '../../src/servicios';
import { useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, Texto } from '../../src/ui';

/** O1 · Bienvenida: la promesa en una frase. Si ya aceptó el aviso (volvió a abrir a medias), sigue en O3. */
export default function Bienvenida() {
  const router = useRouter();
  const yaAcepto = useVista((ctx) => obtenerConsentimiento(ctx) !== null);
  return (
    <PasoOnboarding
      testID="onb-bienvenida"
      paso={1}
      titulo="Sabe cada día cuánto puedes gastar"
      ayuda="Sin quedarte corto antes de tu próximo pago. Te toma unos 4 minutos y todo se queda en tu teléfono."
      pie={
        <Boton
          testID="onb-empezar"
          etiqueta={yaAcepto ? 'Continuar' : 'Empezar'}
          alPresionar={() => router.push(yaAcepto ? '/onboarding/ingreso' : '/onboarding/consentimiento')}
        />
      }
    >
      <Texto variante="cuerpo">
        Anota lo que tienes, lo que debes y tus pagos fijos. Finanvoz hace las cuentas por ti.
      </Texto>
    </PasoOnboarding>
  );
}
