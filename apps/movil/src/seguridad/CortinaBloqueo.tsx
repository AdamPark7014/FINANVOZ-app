import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { anunciar } from '../ui/anunciar';
import { Boton } from '../ui/componentes/Boton';
import { Texto } from '../ui/componentes/Texto';
import { useTema } from '../ui/tema';
import { espacio, margenPantalla } from '../ui/tokens';
import { mensajeAutenticacion } from './autenticador';
import type { Bloqueo } from './useBloqueo';

/** Pista de «Desbloquear» con las palabras de cada plataforma. */
export function pistaDesbloquear(os: string = Platform.OS): string {
  return os === 'ios' ? 'Usa Face ID o el código del iPhone' : 'Usa tu huella, tu cara o el PIN del teléfono';
}

/**
 * Cubre toda la app mientras está bloqueada: no muestra ninguna cifra ni dato.
 * Recibe el resultado de `useBloqueo`.
 */
export function CortinaBloqueo({ bloqueo }: { bloqueo: Bloqueo }) {
  const { c } = useTema();
  const mensaje = bloqueo.bloqueado && bloqueo.error ? mensajeAutenticacion(bloqueo.error) : null;
  // VoiceOver no lee la región viva: en iPhone el motivo se anuncia aparte.
  useEffect(() => {
    if (mensaje) anunciar(mensaje);
  }, [mensaje]);
  if (!bloqueo.bloqueado) return null;
  return (
    <View
      testID="cortina-bloqueo"
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: c.fondo,
        justifyContent: 'center',
        padding: margenPantalla,
        gap: espacio.l,
      }}
    >
      <Texto variante="titulo" alinear="center">
        Finanvoz está bloqueada
      </Texto>
      {mensaje ? (
        <Texto variante="cuerpo" tono="secundario" alinear="center" accessibilityLiveRegion="polite">
          {mensaje}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Desbloquear"
        pista={pistaDesbloquear()}
        cargando={bloqueo.autenticando}
        alPresionar={() => {
          void bloqueo.desbloquear();
        }}
      />
    </View>
  );
}
