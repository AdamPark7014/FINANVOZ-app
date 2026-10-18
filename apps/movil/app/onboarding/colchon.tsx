import type { Centavos } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ERROR_GUARDAR, MensajeError, PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import { colchonSugerido, completarOnboarding, fijarColchon } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto, formatearCentavos } from '../../src/ui';

/** O7 · Colchón (RF-CFG-02): sugerencia del 10 % del ingreso del periodo → "Ver mi día" termina el onboarding. */
export default function Colchon() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const sugerido = useVista(colchonSugerido);
  const [monto, setMonto] = useState<Centavos | null>(sugerido > 0 ? sugerido : null);
  const [error, setError] = useState<string | null>(null);

  const terminar = (colchon: Centavos) => {
    try {
      fijarColchon(ctx, colchon);
      completarOnboarding(ctx);
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.replace('/hoy');
  };

  return (
    <PasoOnboarding
      testID="onb-colchon"
      paso={7}
      titulo="¿Cuánto quieres no tocar nunca?"
      ayuda="Tu colchón no cuenta para lo que puedes gastar. Lo cambias cuando quieras en Ajustes › Colchón."
      pie={
        <>
          <Boton testID="onb-ver-mi-dia" etiqueta="Ver mi día" alPresionar={() => terminar(monto ?? 0)} />
          <Boton
            testID="onb-colchon-saltar"
            variante="texto"
            etiqueta="Sin colchón por ahora"
            alPresionar={() => terminar(0)}
          />
        </>
      }
    >
      <CampoMonto
        testID="onb-colchon-monto"
        etiqueta="Tu colchón"
        valorInicial={sugerido > 0 ? sugerido : null}
        {...(sugerido > 0
          ? { ayuda: `Te sugerimos ${formatearCentavos(sugerido)}: el 10 % de lo que te pagan.` }
          : {})}
        alCambiar={setMonto}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
