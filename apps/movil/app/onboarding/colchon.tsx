import type { Centavos } from '@cartera/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ERROR_GUARDAR, MensajeError, PasoOnboarding } from '../../src/pantallas/onboarding/componentes';
import { sugerenciaMontoColchon10 } from '../../src/pantallas/ajustes/colchon-textos';
import {
  AYUDA_COLCHON_ONB,
  BTN_SIN_COLCHON_POR_AHORA,
  BTN_VER_MI_DIA,
  ETIQUETA_COLCHON,
  PISTA_COLCHON_SALTAR,
  PISTA_VER_MI_DIA,
  TIP_COLCHON_SIN_POR_AHORA,
  TITULO_COLCHON,
} from '../../src/pantallas/onboarding/textos';
import { colchonSugerido, completarOnboarding, fijarColchon } from '../../src/servicios';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto } from '../../src/ui';

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
      titulo={TITULO_COLCHON}
      ayuda={AYUDA_COLCHON_ONB}
      tip={TIP_COLCHON_SIN_POR_AHORA}
      pie={
        <>
          <Boton testID="onb-ver-mi-dia" etiqueta={BTN_VER_MI_DIA} alPresionar={() => terminar(monto ?? 0)} />
          <Boton
            testID="onb-colchon-saltar"
            variante="texto"
            etiqueta={BTN_SIN_COLCHON_POR_AHORA}
            alPresionar={() => terminar(0)}
          />
        </>
      }
    >
      <CampoMonto
        testID="onb-colchon-monto"
        etiqueta={ETIQUETA_COLCHON}
        valorInicial={sugerido > 0 ? sugerido : null}
        {...(sugerido > 0 ? { ayuda: sugerenciaMontoColchon10(sugerido) } : {})}
        alCambiar={setMonto}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
