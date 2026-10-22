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
  /** Contenido fijo al pie (p. ej. "Guardar"), fuera del desplazamiento; sube con el teclado. */
  pie?: ReactNode;
  contenidoStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Contenedor con área segura, desplazamiento opcional y pie fijo fuera del scroll.
 *
 * Teclado: Android ya encoge la ventana (`adjustResize`). En iPhone el teclado se dibuja encima, así que:
 * - con pie fijo (o sin desplazamiento) todo va dentro de un `KeyboardAvoidingView` con `padding`: el área
 *   desplazable se encoge y el pie ("Continuar", "Registrar") queda justo arriba del teclado;
 * - sin pie, el `ScrollView` ajusta sus márgenes al teclado y desplaza el campo enfocado a la vista
 *   (`automaticallyAdjustKeyboardInsets`). No se combinan: los dos sumarían el alto del teclado.
 * Arrastrar el contenido cierra el teclado (interactivo en iPhone) y un toque en un botón no se pierde
 * mientras el teclado está abierto (`keyboardShouldPersistTaps`).
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
  const ios = Platform.OS === 'ios';
  const evitarTeclado = ios && (Boolean(pie) || !desplazable);
  const contenido: ViewStyle = { padding: margenPantalla, gap: espacio.l };
  const cuerpo = (
    <>
      {desplazable ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[contenido, contenidoStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={ios ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={ios && !evitarTeclado}
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
    </>
  );
  return (
    <SafeAreaView testID={testID} edges={bordes} style={{ flex: 1, backgroundColor: c.fondo }}>
      {evitarTeclado ? (
        // Dentro del área segura: el pie queda pegado al teclado sin el hueco del indicador de inicio.
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {cuerpo}
        </KeyboardAvoidingView>
      ) : (
        cuerpo
      )}
    </SafeAreaView>
  );
}
