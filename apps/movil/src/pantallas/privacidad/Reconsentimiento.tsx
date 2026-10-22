import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { aceptarConsentimiento, rechazarReconsentimiento, VERSION_CONSENTIMIENTO } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { AVISO_SIMPLIFICADO, etiquetaAvisoSimplificadoOnboarding } from '../onboarding/aviso';
import { Casilla, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { Boton, CampoTexto, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import {
  BTN_BORRAR_CONFIRMAR,
  BTN_CANCELAR,
  BTN_LEER_AVISO_COMPLETO,
  BTN_RECONSENT_ACEPTAR,
  BTN_RECONSENT_BORRAR,
  BTN_RECONSENT_SOLO_LECTURA,
  CASILLA_ESTADISTICAS_OPCIONAL,
  CASILLA_RECONSENT_DATOS,
  etiquetaConfirmarBorrar,
  etiquetaIntroReconsentimiento,
  introReconsentimiento,
  PALABRA_BORRAR,
  PISTA_BORRAR_CANCELAR,
  PISTA_BORRAR_CONFIRMAR,
  PISTA_CASILLA_DATOS_FINANCIEROS,
  PISTA_LEER_AVISO_COMPLETO,
  PISTA_RECONSENT_ACEPTAR,
  PISTA_RECONSENT_BORRAR,
  PISTA_RECONSENT_SOLO_LECTURA,
  TEXTO_BORRAR_ADVERTENCIA,
  TITULO_AVISO_PRIVACIDAD,
  TITULO_RECONSENTIMIENTO,
} from './textos';

/**
 * Aviso de privacidad actualizado (pendiente 31): aceptar la nueva versión, seguir en solo lectura o borrar todo.
 * Borrar todo pide escribir BORRAR, igual que el centro de privacidad: un toque nunca borra los datos.
 */
export function Reconsentimiento({ alBorrarTodo }: { alBorrarTodo: () => Promise<void> }) {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const [acepta, setAcepta] = useState(false);
  const [estadisticas, setEstadisticas] = useState(false);
  const [error, setErrorBase] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [palabra, setPalabra] = useState('');
  const setError = (texto: string | null) => {
    setErrorBase(texto);
    // VoiceOver no lee la región viva de `MensajeError`.
    if (texto) anunciar(texto);
  };
  const palabraCorrecta = palabra.trim().toUpperCase() === PALABRA_BORRAR;

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
    if (!palabraCorrecta) return;
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
      <Tarjeta>
        {/*
          Solo el resumen se agrupa en un elemento: en iOS un contenedor `accessible` vuelve inalcanzables para
          VoiceOver los botones que tenga dentro, así que «Leer el aviso completo» queda fuera del grupo.
        */}
        <View
          testID="reconsent-aviso-simplificado"
          accessible
          accessibilityRole="summary"
          accessibilityLabel={etiquetaAvisoSimplificadoOnboarding(
            TITULO_AVISO_PRIVACIDAD,
            AVISO_SIMPLIFICADO,
          )}
          style={{ gap: espacio.s }}
        >
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
      {confirmando ? (
        <Tarjeta testID="reconsent-borrar-confirmacion">
          <Texto variante="cuerpo" accessibilityRole="alert">
            {TEXTO_BORRAR_ADVERTENCIA}
          </Texto>
          <CampoTexto
            testID="reconsent-borrar-palabra"
            etiqueta={etiquetaConfirmarBorrar()}
            valor={palabra}
            alCambiar={setPalabra}
            nativo={{ autoCapitalize: 'characters', autoCorrect: false }}
          />
          <Boton
            testID="reconsent-borrar-confirmar"
            etiqueta={BTN_BORRAR_CONFIRMAR}
            pista={PISTA_BORRAR_CONFIRMAR}
            deshabilitado={!palabraCorrecta || borrando}
            cargando={borrando}
            alPresionar={() => void borrarTodo()}
          />
          <Boton
            testID="reconsent-borrar-cancelar"
            variante="texto"
            etiqueta={BTN_CANCELAR}
            pista={PISTA_BORRAR_CANCELAR}
            deshabilitado={borrando}
            alPresionar={() => {
              setConfirmando(false);
              setPalabra('');
            }}
          />
        </Tarjeta>
      ) : (
        <Boton
          testID="reconsent-borrar"
          variante="texto"
          etiqueta={BTN_RECONSENT_BORRAR}
          pista={PISTA_RECONSENT_BORRAR}
          alPresionar={() => {
            setError(null);
            setConfirmando(true);
          }}
        />
      )}
      <MensajeError texto={error} />
    </Pantalla>
  );
}
