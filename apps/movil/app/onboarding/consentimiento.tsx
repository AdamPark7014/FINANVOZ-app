import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AVISO_SIMPLIFICADO } from '../../src/pantallas/onboarding/aviso';
import {
  Casilla,
  ERROR_GUARDAR,
  MensajeError,
  PasoOnboarding,
} from '../../src/pantallas/onboarding/componentes';
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
      titulo="Tus datos son tuyos"
      pie={
        <Boton
          testID="onb-aceptar"
          etiqueta="Aceptar y continuar"
          deshabilitado={!acepta}
          {...(acepta ? {} : { pista: 'Primero marca la casilla de tus datos financieros' })}
          alPresionar={aceptar}
        />
      }
    >
      <Tarjeta>
        <Texto variante="subtitulo">Aviso de privacidad</Texto>
        <View style={{ gap: espacio.s }}>
          {AVISO_SIMPLIFICADO.map((punto) => (
            <Texto key={punto} variante="secundario">
              {`• ${punto}`}
            </Texto>
          ))}
        </View>
        <Boton
          testID="onb-aviso-completo"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer el aviso completo"
          alPresionar={() => router.push('/aviso-privacidad')}
        />
      </Tarjeta>
      <Casilla
        testID="onb-casilla-datos"
        etiqueta="Acepto que Finanvoz guarde y use mis datos financieros para funcionar, como dice el aviso."
        valor={acepta}
        alCambiar={setAcepta}
      />
      <Casilla
        testID="onb-casilla-estadisticas"
        etiqueta="Compartir estadísticas anónimas de uso para mejorar la app (opcional)."
        valor={estadisticas}
        alCambiar={setEstadisticas}
      />
      <MensajeError texto={error} />
    </PasoOnboarding>
  );
}
