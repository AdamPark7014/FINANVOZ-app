import { useRouter } from 'expo-router';
import { PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import { PISTA_TARJETA_DESPUES_ONB, PISTA_TARJETA_GUARDAR_ONB } from '../../src/pantallas/onboarding/textos';
import { useFormularioTarjeta } from '../../src/pantallas/tarjetas/FormularioTarjetaNueva';
import { Boton } from '../../src/ui';

/**
 * O4 · Tarjeta de crédito completa (`02 §3.1`): ciclo, límite, modo, saldo obligatorio, meses que ya tenías y
 * "¿El saldo ya los incluye?". Sin saldo no se crea ("Agregar después"). El formulario es el mismo de
 * Cuentas → "Agregar tarjeta".
 */
export default function TarjetaCredito() {
  const router = useRouter();
  const { campos, guardar } = useFormularioTarjeta({ alGuardar: () => router.back() });
  return (
    <PasoOnboarding
      testID="onb-tarjeta"
      paso={4}
      titulo="Tarjeta de crédito"
      pie={
        <>
          <Boton
            testID="tarjeta-guardar"
            etiqueta="Guardar tarjeta"
            pista={PISTA_TARJETA_GUARDAR_ONB}
            alPresionar={guardar}
          />
          <Boton
            testID="tarjeta-despues"
            variante="texto"
            etiqueta="Agregar después"
            pista={PISTA_TARJETA_DESPUES_ONB}
            alPresionar={() => router.back()}
          />
        </>
      }
    >
      {campos}
    </PasoOnboarding>
  );
}
