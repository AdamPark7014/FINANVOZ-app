import type { Centavos } from '@cartera/core';
import type { LecturaPaso } from '@cartera/nlu';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
  pasoVisibleOnb,
} from '../../src/pantallas/onboarding/componentes';
import { DecirloPaso, type PropuestaDecirlo } from '../../src/pantallas/onboarding/DecirloPaso';
import { sugerenciaMontoColchon10 } from '../../src/pantallas/ajustes/colchon-textos';
import {
  AYUDA_COLCHON_ONB,
  BTN_CAMBIAR_ALGO,
  BTN_SI_GUARDALO,
  BTN_SIN_COLCHON_POR_AHORA,
  BTN_VER_MI_DIA,
  EFECTO_APROXIMADO,
  EFECTO_COLCHON,
  ETIQUETA_COLCHON,
  PISTA_COLCHON_SALTAR,
  PISTA_VER_MI_DIA,
  TIP_COLCHON_SIN_POR_AHORA,
  TITULO_COLCHON,
  TITULO_ENTENDI_GUARDO,
} from '../../src/pantallas/onboarding/textos';
import { colchonSugerido, completarOnboarding, fijarColchon } from '../../src/servicios';
import { contextoPasoOnboarding } from '../../src/servicios/onboarding';
import { useSesion, useVista } from '../../src/sesion/ProveedorSesion';
import { Boton, CampoMonto } from '../../src/ui';

/**
 * O7 · Colchón (RF-CFG-02): sugerencia del 10 % del ingreso del periodo → "Ver mi día" termina el onboarding.
 * «Dímelo» («quiero 2 mil de colchón», «nada») → «Entendí» → «Sí» guarda y abre tu día sin formulario (Ola 7 §7).
 */
export default function Colchon() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const contexto = useVista(contextoPasoOnboarding);
  const sugerido = useVista(colchonSugerido);
  const [monto, setMonto] = useState<Centavos | null>(sugerido > 0 ? sugerido : null);
  // Sube con «Cambiar algo»: el campo se vuelve a montar con lo dicho y con el foco.
  const [versionCampo, setVersionCampo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Guarda y abre tu día; si falla, lanza (la tarjeta «Entendí» lo dice) y no navega. */
  const guardar = (colchon: Centavos) => {
    fijarColchon(ctx, colchon);
    completarOnboarding(ctx);
    refrescar();
    router.replace('/hoy');
  };

  const terminar = (colchon: Centavos) => {
    try {
      guardar(colchon);
    } catch {
      setError(ERROR_GUARDAR);
    }
  };

  const proponer = (l: LecturaPaso): PropuestaDecirlo | null => {
    if (l.paso !== 'colchon') return null;
    const { monto: dicho, aproximado } = l.monto;
    return {
      titulo: TITULO_ENTENDI_GUARDO,
      ...(dicho > 0 ? { monto: dicho } : {}),
      filas:
        dicho > 0 ? [] : [{ clave: 'colchon', etiqueta: ETIQUETA_COLCHON, valor: BTN_SIN_COLCHON_POR_AHORA }],
      efecto: aproximado ? EFECTO_APROXIMADO : EFECTO_COLCHON,
      confirmar: { etiqueta: BTN_SI_GUARDALO, accion: () => guardar(dicho) },
      cambiar: {
        etiqueta: BTN_CAMBIAR_ALGO,
        accion: () => {
          setMonto(dicho);
          setVersionCampo((v) => v + 1);
        },
      },
    };
  };

  return (
    <PasoOnboarding
      testID="onb-colchon"
      paso={pasoVisibleOnb(7)}
      titulo={TITULO_COLCHON}
      ayuda={AYUDA_COLCHON_ONB}
      tip={TIP_COLCHON_SIN_POR_AHORA}
      pie={
        <>
          <Boton
            testID="onb-ver-mi-dia"
            etiqueta={BTN_VER_MI_DIA}
            pista={PISTA_VER_MI_DIA}
            alPresionar={() => terminar(monto ?? 0)}
          />
          <Boton
            testID="onb-colchon-saltar"
            variante="texto"
            etiqueta={BTN_SIN_COLCHON_POR_AHORA}
            pista={PISTA_COLCHON_SALTAR}
            alPresionar={() => terminar(0)}
          />
        </>
      }
    >
      <DecirloPaso
        testID="onb-colchon-decir"
        pasos={['colchon']}
        ejemplo="quiero 2 mil de colchón"
        correccion="no, son 3 mil"
        contexto={contexto}
        proponer={proponer}
      />
      <CampoMonto
        key={`colchon-${versionCampo}`}
        testID="onb-colchon-monto"
        etiqueta={ETIQUETA_COLCHON}
        valorInicial={versionCampo > 0 ? monto : sugerido > 0 ? sugerido : null}
        {...(sugerido > 0 ? { ayuda: sugerenciaMontoColchon10(sugerido) } : {})}
        alCambiar={setMonto}
        autoFocus={versionCampo > 0}
        admiteCero
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
