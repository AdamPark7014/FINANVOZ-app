import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { aceptarConsentimiento, rechazarReconsentimiento, VERSION_CONSENTIMIENTO } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { AVISO_SIMPLIFICADO, etiquetaAvisoSimplificadoOnboarding } from '../onboarding/aviso';
import { Casilla, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import {
  BTN_LEER_AVISO_COMPLETO,
  BTN_RECONSENT_ACEPTAR,
  BTN_RECONSENT_BORRAR,
  BTN_RECONSENT_SOLO_LECTURA,
  CASILLA_ESTADISTICAS_OPCIONAL,
  CASILLA_RECONSENT_DATOS,
  etiquetaIntroReconsentimiento,
  introReconsentimiento,
  PISTA_CASILLA_DATOS_FINANCIEROS,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_RECONSENT_ACEPTAR,
  PISTA_RECONSENT_BORRAR,
  PISTA_RECONSENT_SOLO_LECTURA,
  TITULO_AVISO_PRIVACIDAD,
  TITULO_RECONSENTIMIENTO,
} from './textos';

/**
 * Aviso de privacidad actualizado (pendiente 31): aceptar la nueva versión, seguir en solo lectura o borrar todo.
 */
export function Reconsentimiento({ alBorrarTodo }: { alBorrarTodo: () => Promise<void> }) {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const [acepta, setAcepta] = useState(false);
  const [estadisticas, setEstadisticas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  const aceptar = () => {
    try {
      aceptarConsentimiento(ctx, {
        datosFinancieros: true,
        estadisticas,
        medio: 'reconsentimiento',
      });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    refrescar();
    router.replace('/hoy');
  };

  const soloLectura = () => {
    rechazarReconsentimiento(ctx);
    refrescar();
    router.replace('/hoy');
  };

  const borrarTodo = async () => {
    setBorrando(true);
    setError(null);
    try {
      await alBorrarTodo();
    } catch {
      setError(ERROR_GUARDAR);
      setBorrando(false);
    }
  };

  return (
    <Pantalla testID="reconsentimiento" bordes={['top', 'left', 'right', 'bottom']}>
      <Texto testID="reconsent-titulo" variante="titulo" accessibilityRole="header">
        {TITULO_RECONSENTIMIENTO}
      </Texto>
      <Texto
        testID="reconsent-intro"
        variante="secundario"
        tono="secundario"
        accessibilityRole="text"
        accessibilityLabel={etiquetaIntroReconsentimiento(VERSION_CONSENTIMIENTO)}
      >
        {introReconsentimiento(VERSION_CONSENTIMIENTO)}
      </Texto>
      <View
        testID="reconsent-aviso-simplificado"
        accessible
        accessibilityRole="summary"
        accessibilityLabel={etiquetaAvisoSimplificadoOnboarding(TITULO_AVISO_PRIVACIDAD, AVISO_SIMPLIFICADO)}
      >
        <Tarjeta>
          <Texto variante="subtitulo" accessibilityElementsHidden>
            {TITULO_AVISO_PRIVACIDAD}
          </Texto>
          <View style={{ gap: espacio.s }} importantForAccessibility="no-hide-descendants">
            {AVISO_SIMPLIFICADO.map((punto) => (
              <Texto key={punto} variante="secundario" accessibilityElementsHidden>
                {`• ${punto}`}
              </Texto>
            ))}
          </View>
          <Boton
            testID="reconsent-aviso-completo"
            variante="texto"
            ancho="contenido"
            etiqueta={BTN_LEER_AVISO_COMPLETO}
            pista={PISTA_LEER_AVISO_COMPLETO}
            alPresionar={() => router.push('/aviso-privacidad')}
          />
        </Tarjeta>
      </View>
      <Casilla
        testID="reconsent-casilla-datos"
        etiqueta={CASILLA_RECONSENT_DATOS}
        valor={acepta}
        alCambiar={setAcepta}
      />
      <Casilla
        testID="reconsent-casilla-estadisticas"
        etiqueta={CASILLA_ESTADISTICAS_OPCIONAL}
        valor={estadisticas}
        alCambiar={setEstadisticas}
      />
      <Boton
        testID="reconsent-aceptar"
        etiqueta={BTN_RECONSENT_ACEPTAR}
        deshabilitado={!acepta}
        pista={acepta ? PISTA_RECONSENT_ACEPTAR : PISTA_CASILLA_DATOS_FINANCIEROS}
        alPresionar={aceptar}
      />
      <Boton
        testID="reconsent-solo-lectura"
        variante="secundario"
        etiqueta={BTN_RECONSENT_SOLO_LECTURA}
        pista={PISTA_RECONSENT_SOLO_LECTURA}
        alPresionar={soloLectura}
      />
      <Boton
        testID="reconsent-borrar"
        variante="texto"
        etiqueta={BTN_RECONSENT_BORRAR}
        deshabilitado={borrando}
        cargando={borrando}
        pista={PISTA_RECONSENT_BORRAR}
        alPresionar={() => void borrarTodo()}
      />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
