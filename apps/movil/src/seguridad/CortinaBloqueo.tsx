import { View } from 'react-native';
import { Boton } from '../ui/componentes/Boton';
import { Texto } from '../ui/componentes/Texto';
import { useTema } from '../ui/tema';
import { espacio, margenPantalla } from '../ui/tokens';
import { MENSAJES_AUTENTICACION } from './autenticador';
import type { Bloqueo } from './useBloqueo';

/**
 * Cubre toda la app mientras está bloqueada: no muestra ninguna cifra ni dato.
 * Recibe el resultado de `useBloqueo`.
 */
export function CortinaBloqueo({ bloqueo }: { bloqueo: Bloqueo }) {
  const { c } = useTema();
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
      {bloqueo.error ? (
        <Texto variante="cuerpo" tono="secundario" alinear="center" accessibilityLiveRegion="polite">
          {MENSAJES_AUTENTICACION[bloqueo.error]}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Desbloquear"
        pista="Usa tu huella, tu cara o el PIN del teléfono"
        cargando={bloqueo.autenticando}
        alPresionar={() => {
          void bloqueo.desbloquear();
        }}
      />
    </View>
  );
}
