import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTema } from '../tema';
import { espacio, margenPantalla } from '../tokens';

export interface PantallaProps {
  children: ReactNode;
  /** `false` para pantallas con lista virtualizada propia. */
  desplazable?: boolean;
  /** Bordes con área segura; las pestañas ya cubren el inferior. */
  bordes?: readonly Edge[];
  /** Contenido fijo al pie (p. ej. "Guardar"), fuera del desplazamiento. */
  pie?: ReactNode;
  contenidoStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Contenedor con área segura, desplazamiento opcional y pie fijo fuera del scroll.
 * En iOS el sistema no reacomoda la pantalla con el teclado: `KeyboardAvoidingView` sube el contenido y el pie
 * (cada pantalla llena su contenedor desde y = 0, así que no hace falta desfase).
 */
export function Pantalla({
  children,
  desplazable = true,
  bordes = ['top', 'left', 'right'],
  pie,
  contenidoStyle,
  testID,
}: PantallaProps) {
  const { c } = useTema();
  const contenido: ViewStyle = { padding: margenPantalla, gap: espacio.l };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: c.fondo }}
    >
      <SafeAreaView testID={testID} edges={bordes} style={{ flex: 1, backgroundColor: c.fondo }}>
        {desplazable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[contenido, contenidoStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contenido, contenidoStyle]}>{children}</View>
        )}
        {pie ? (
          <View
            style={{
              paddingHorizontal: margenPantalla,
              paddingVertical: espacio.m,
              borderTopWidth: 1,
              borderTopColor: c.borde,
              backgroundColor: c.fondo,
            }}
          >
            {pie}
          </View>
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
