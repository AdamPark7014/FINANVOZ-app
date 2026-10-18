import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  aceptarConsentimiento,
  rechazarReconsentimiento,
  VERSION_CONSENTIMIENTO,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { AVISO_SIMPLIFICADO } from '../onboarding/aviso';
import { Casilla, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../../ui';

/**
 * Aviso de privacidad actualizado (pendiente 31): aceptar la nueva versión, seguir en solo lectura o borrar todo.
 */
export function Reconsentimiento({
  alBorrarTodo,
}: {
  alBorrarTodo: () => Promise<void>;
}) {
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
      <Texto variante="titulo">Actualizamos el aviso de privacidad</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Hay una versión nueva (${VERSION_CONSENTIMIENTO}). Si no la aceptas, puedes seguir viendo y exportando tus datos, pero no registrar movimientos nuevos.`}
      </Texto>
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
          testID="reconsent-aviso-completo"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer el aviso completo"
          alPresionar={() => router.push('/aviso-privacidad')}
        />
      </Tarjeta>
      <Casilla
        testID="reconsent-casilla-datos"
        etiqueta="Acepto la nueva versión del aviso y que Finanvoz siga guardando y usando mis datos financieros."
        valor={acepta}
        alCambiar={setAcepta}
      />
      <Casilla
        testID="reconsent-casilla-estadisticas"
        etiqueta="Compartir estadísticas anónimas de uso para mejorar la app (opcional)."
        valor={estadisticas}
        alCambiar={setEstadisticas}
      />
      <Boton
        testID="reconsent-aceptar"
        etiqueta="Aceptar y continuar"
        deshabilitado={!acepta}
        {...(acepta ? {} : { pista: 'Primero marca la casilla de tus datos financieros' })}
        alPresionar={aceptar}
      />
      <Boton
        testID="reconsent-solo-lectura"
        variante="secundario"
        etiqueta="Continuar sin aceptar (solo lectura)"
        alPresionar={soloLectura}
      />
      <Boton
        testID="reconsent-borrar"
        variante="texto"
        etiqueta="Borrar todo"
        deshabilitado={borrando}
        alPresionar={() => void borrarTodo()}
      />
      <MensajeError texto={error} />
    </Pantalla>
  );
}
