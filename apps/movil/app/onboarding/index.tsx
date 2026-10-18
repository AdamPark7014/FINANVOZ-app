import { useRouter } from 'expo-router';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import {
  AYUDA_BIENVENIDA,
  BTN_ONB_CONTINUAR,
  BTN_ONB_EMPEZAR,
  CUERPO_BIENVENIDA,
  PISTA_ONB_CONTINUAR,
  PISTA_ONB_EMPEZAR,
  TITULO_BIENVENIDA,
} from '../../src/pantallas/onboarding/textos';
import { BTN_ONBOARDING_RESTAURAR, PISTA_ONBOARDING_RESTAURAR } from '../../src/pantallas/respaldo';
import { obtenerConsentimiento } from '../../src/servicios';
import { useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, Texto } from '../../src/ui';

/**
 * O1 · Bienvenida: la promesa en una frase. Si ya aceptó el aviso (volvió a abrir a medias), sigue en O3. Quien
 * viene de otro teléfono puede restaurar su respaldo (M9).
 */
export default function Bienvenida() {
  const router = useRouter();
  const yaAcepto = useVista((ctx) => obtenerConsentimiento(ctx) !== null);
  return (
    <PasoOnboarding
      testID="onb-bienvenida"
      paso={1}
      titulo={TITULO_BIENVENIDA}
      ayuda={AYUDA_BIENVENIDA}
      pie={
        <>
          <Boton
            testID="onb-empezar"
            etiqueta={yaAcepto ? BTN_ONB_CONTINUAR : BTN_ONB_EMPEZAR}
            pista={yaAcepto ? PISTA_ONB_CONTINUAR : PISTA_ONB_EMPEZAR}
            alPresionar={() => router.push(yaAcepto ? '/onboarding/ingreso' : '/onboarding/consentimiento')}
          />
          {/* Teléfono nuevo (`02 §19`): restaurar un respaldo en lugar de empezar de cero. */}
          <Boton
            testID="onb-restaurar"
            variante="texto"
            etiqueta={BTN_ONBOARDING_RESTAURAR}
            pista={PISTA_ONBOARDING_RESTAURAR}
            alPresionar={() => router.push('/restaurar')}
          />
        </>
      }
    >
      <Texto variante="cuerpo">
        {CUERPO_BIENVENIDA}
      </Texto>
    </PasoOnboarding>
  );
}
