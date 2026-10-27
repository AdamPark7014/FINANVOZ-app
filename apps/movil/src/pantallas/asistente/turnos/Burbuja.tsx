import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Boton, espacio, useTema } from '../../../ui';

/**
 * Un turno del asistente (dirección B «Plática»): lo que dice va en texto grande, sin burbuja ni sombra; solo lo que
 * dices tú lleva burbuja (`TurnoPersona`). `resaltada` (la de «Entendí») conserva un filo a la izquierda para que la
 * pregunta se distinga del resto.
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
        gap: espacio.m,
        paddingRight: espacio.xl,
        ...(resaltada ? { borderLeftWidth: 3, borderLeftColor: c.acento, paddingLeft: espacio.m } : null),
      }}
    >
      {children}
    </View>
  );
}

/** Acción en línea de un turno («Ver movimientos»): `Boton` de texto, 48 dp y etiqueta hablada. */
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
