import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio, sombra } from '../tokens';

export interface TarjetaProps {
  children: ReactNode;
  /** Si se toca, lleva al detalle (02-UX §1.4: toda cifra se puede tocar). */
  alPresionar?: () => void;
  /** Nombre en TalkBack; incluye montos en palabras (`etiquetaHablada`). */
  etiquetaAccesible?: string;
  pista?: string;
  /** Si hay botones dentro, el toque de fondo no bloquea sus controles ni el lector. */
  accionesAnidadas?: boolean;
  /** Tarjetas que se abren/cierran (p. ej. detalle de un movimiento). */
  expandida?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Superficie con borde; opcionalmente botón con `etiquetaAccesible` o fondo tocable si hay controles anidados. */
export function Tarjeta({
  children,
  alPresionar,
  etiquetaAccesible,
  pista,
  accionesAnidadas = false,
  expandida,
  style,
  testID,
}: TarjetaProps) {
  const { c, esquema } = useTema();
  const base: ViewStyle = {
    backgroundColor: c.superficie,
    borderColor: c.borde,
    borderWidth: 1,
    borderRadius: radio.xl,
    padding: espacio.l,
    gap: espacio.m,
    ...sombra.tarjeta[esquema],
  };
  const ripple = { color: c.borde, borderless: false };
  const estadoAccesible = expandida === undefined ? undefined : ({ expanded: expandida } as const);

  if (!alPresionar) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }

  if (accionesAnidadas) {
    // El Pressable envuelve al contenido: tocar el texto o la cifra también responde, y los botones de adentro
    // ganan su propio toque. `accessible={false}` deja que el lector de pantalla llegue a cada botón.
    return (
      <Pressable
        testID={testID}
        onPress={alPresionar}
        accessible={false}
        importantForAccessibility="no"
        android_ripple={ripple}
        style={({ pressed }) => [
          base,
          { minHeight: OBJETIVO_TACTIL_MIN },
          style,
          pressed ? { backgroundColor: c.superficieAlterna } : null,
        ]}
      >
        <View style={{ gap: espacio.m }}>{children}</View>
      </Pressable>
    );
  }

  const contenido =
    etiquetaAccesible !== undefined ? (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    ) : (
      children
    );

  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      accessibilityHint={pista}
      {...(estadoAccesible ? { accessibilityState: estadoAccesible } : {})}
      android_ripple={ripple}
      style={({ pressed }) => [
        base,
        { minHeight: OBJETIVO_TACTIL_MIN },
        pressed ? { backgroundColor: c.superficieAlterna } : null,
        style,
      ]}
    >
      {contenido}
    </Pressable>
  );
}
