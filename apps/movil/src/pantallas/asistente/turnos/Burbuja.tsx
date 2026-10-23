import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Boton, espacio, radio, useTema } from '../../../ui';

/**
 * Burbuja de un turno del asistente (maqueta Hoy A): superficie con borde, esquina inferior izquierda casi recta.
 * `resaltada` es la de «Entendí» (borde de acento). Tokens de tema: en oscuro nunca hay blanco puro.
 */
export function Burbuja({
  children,
  resaltada = false,
  testID,
  ...accesibilidad
}: {
  children: ReactNode;
  resaltada?: boolean;
  testID?: string;
} & Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole'>) {
  const { c } = useTema();
  return (
    <View
      {...(testID ? { testID } : {})}
      {...accesibilidad}
      style={{
        backgroundColor: c.superficie,
        borderWidth: 1,
        borderColor: resaltada ? c.acentoTexto : c.borde,
        borderTopLeftRadius: radio.l,
        borderTopRightRadius: radio.l,
        borderBottomRightRadius: radio.l,
        borderBottomLeftRadius: espacio.xs,
        padding: espacio.l,
        gap: espacio.s,
      }}
    >
      {children}
    </View>
  );
}

/** Acción en línea de un turno («Deshacer», «Ver movimientos»): `Boton` de texto, 48 dp y etiqueta hablada. */
export function AccionTexto({
  etiqueta,
  alPresionar,
  pista,
  testID,
}: {
  etiqueta: string;
  alPresionar: () => void;
  pista?: string;
  testID?: string;
}) {
  return (
    <Boton
      etiqueta={etiqueta}
      variante="texto"
      ancho="contenido"
      alPresionar={alPresionar}
      pista={pista}
      {...(testID ? { testID } : {})}
      style={{ paddingHorizontal: espacio.xs }}
    />
  );
}
