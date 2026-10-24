import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  AVISO_SIMPLIFICADO,
  etiquetaAvisoSimplificadoOnboarding,
} from '../../src/pantallas/onboarding/aviso';
import {
  Casilla,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
import {
  BTN_ACEPTAR_CONTINUAR,
  BTN_LEER_AVISO_COMPLETO,
  CASILLA_DATOS_FINANCIEROS,
  CASILLA_ESTADISTICAS_OPCIONAL,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_MARCAR_CASILLA_DATOS,
  PISTA_ONB_CONTINUAR,
  TIP_CONSENTIMIENTO,
  TITULO_AVISO_SIMPLIFICADO,
  TITULO_CONSENTIMIENTO,
} from '../../src/pantallas/onboarding/textos';
import { aceptarConsentimiento } from '../../src/servicios';
import { useSesion } from '../../src/sesion/ProveedorSesion';
import { Boton, espacio, Tarjeta, Texto } from '../../src/ui';

/**
 * O2 · Consentimiento (RF-PRI-01, `08 §2`): aviso simplificado, casilla obligatoria sin marcar y casilla opcional
 * de estadísticas (apagada). Nada se escribe antes de "Aceptar y continuar"; al aceptar queda la evidencia.
 */
export default function Consentimiento() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const [acepta, setAcepta] = useState(false);
  const [estadisticas, setEstadisticas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aceptar = () => {
    try {
      aceptarConsentimiento(ctx, { datosFinancieros: true, estadisticas });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.replace('/onboarding/ingreso');
  };

  return (
    <PasoOnboarding
      testID="onb-consentimiento"
      paso={2}
      titulo={TITULO_CONSENTIMIENTO}
      tip={TIP_CONSENTIMIENTO}
      pie={
        // La casilla obligatoria va junto al botón: en pantallas altas quedaba debajo del pie y el botón se veía
        // apagado sin explicación (auditoría 23-10).
        <View style={{ gap: espacio.m }}>
          <Casilla
            testID="onb-casilla-datos"
            etiqueta={CASILLA_DATOS_FINANCIEROS}
            valor={acepta}
            alCambiar={setAcepta}
          />
          <Boton
            testID="onb-aceptar"
            etiqueta={BTN_ACEPTAR_CONTINUAR}
            deshabilitado={!acepta}
            pista={acepta ? PISTA_ONB_CONTINUAR : PISTA_MARCAR_CASILLA_DATOS}
            alPresionar={aceptar}
          />
        </View>
      }
    >
      <View style={{ gap: espacio.l }}>
        <Tarjeta>
          {/*
            Solo el resumen se agrupa en un elemento: en iOS un contenedor `accessible` vuelve inalcanzables para
            VoiceOver los botones que tenga dentro, así que «Leer el aviso completo» queda fuera del grupo (igual que
            en `Reconsentimiento`).
          */}
          <View
            testID="onb-aviso-simplificado"
            accessible
            accessibilityRole="summary"
            accessibilityLabel={etiquetaAvisoSimplificadoOnboarding(
              TITULO_AVISO_SIMPLIFICADO,
              AVISO_SIMPLIFICADO,
            )}
            style={{ gap: espacio.m }}
          >
            <Texto variante="subtitulo" accessibilityElementsHidden>
              {TITULO_AVISO_SIMPLIFICADO}
            </Texto>
            <View style={{ gap: espacio.s }} importantForAccessibility="no-hide-descendants">
              {AVISO_SIMPLIFICADO.map((punto) => (
                <Texto key={punto} variante="secundario" accessibilityElementsHidden>
                  {`• ${punto}`}
                </Texto>
              ))}
            </View>
          </View>
          <Boton
            testID="onb-aviso-completo"
            variante="texto"
            ancho="contenido"
            etiqueta={BTN_LEER_AVISO_COMPLETO}
            pista={PISTA_LEER_AVISO_COMPLETO}
            alPresionar={() => router.push('/aviso-privacidad')}
          />
        </Tarjeta>
        <Casilla
          testID="onb-casilla-estadisticas"
          etiqueta={CASILLA_ESTADISTICAS_OPCIONAL}
          valor={estadisticas}
          alCambiar={setEstadisticas}
        />
        <MensajeError texto={error} />
      </View>
    </PasoOnboarding>
  );
}
