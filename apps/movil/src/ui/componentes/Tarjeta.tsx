import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio } from '../tokens';

export interface TarjetaProps {
  children: ReactNode;
  /** Si se toca, lleva al detalle (02-UX §1.4: toda cifra se puede tocar). */
  alPresionar?: () => void;
  etiquetaAccesible?: string;
  pista?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Tarjeta({ children, alPresionar, etiquetaAccesible, pista, style, testID }: TarjetaProps) {
  const { c } = useTema();
  const base: ViewStyle = {
    backgroundColor: c.superficie,
    borderColor: c.borde,
    borderWidth: 1,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: espacio.s,
  };
  if (!alPresionar) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={alPresionar}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      accessibilityHint={pista}
      style={({ pressed }) => [
        base,
        { minHeight: OBJETIVO_TACTIL_MIN },
        pressed ? { backgroundColor: c.superficieAlterna } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
