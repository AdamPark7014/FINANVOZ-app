import { useRouter } from 'expo-router';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import { Boton, Tarjeta, Texto } from '../../src/ui';

/**
 * O6 · Captura automática. En M2 solo se anuncia ("Disponible pronto", `09` M2): la divulgación de `08 §3.1` y
 * el acceso a notificaciones llegan con M5. No pide ningún permiso.
 */
export default function Captura() {
  const router = useRouter();
  return (
    <PasoOnboarding
      testID="onb-captura"
      paso={6}
      titulo="Registrar tus compras automáticamente"
      pie={
        <Boton
          testID="onb-captura-continuar"
          etiqueta="Continuar"
          alPresionar={() => router.push('/onboarding/colchon')}
        />
      }
    >
      <Tarjeta testID="onb-captura-pronto">
        <Texto variante="etiqueta" tono="acento">
          Disponible pronto
        </Texto>
        <Texto variante="cuerpo">
          Finanvoz podrá anotar tus compras con los avisos de tu banco, sin que tengas que escribirlas.
        </Texto>
      </Tarjeta>
      <Texto variante="cuerpo" tono="secundario">
        Por ahora, dicta o escribe tus gastos: «tacos 80 en efectivo».
      </Texto>
    </PasoOnboarding>
  );
}
