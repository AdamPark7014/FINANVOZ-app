import { HeaderShownContext } from 'expo-router/react-navigation';
import { useContext, type ReactNode } from 'react';
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
  /**
   * Bordes con área segura; las pestañas ya cubren el inferior. Con la barra nativa del Stack visible, el de arriba
   * se ignora: la barra ya cubre la barra de estado y sumarlo dejaba un hueco.
   */
  bordes?: readonly Edge[];
  /** Contenido fijo al pie (p. ej. "Guardar"), fuera del desplazamiento; sube con el teclado. */
  pie?: ReactNode;
  contenidoStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Contenedor con área segura, desplazamiento opcional y pie fijo fuera del scroll.
 *
 * Teclado: se dibuja encima en los dos sistemas (en Android la app va de borde a borde y `adjustResize` ya no encoge
 * la ventana), así que:
 * - en Android, y en iPhone con pie fijo (o sin desplazamiento), todo va dentro de un `KeyboardAvoidingView` con
 *   `padding`: el área desplazable se encoge y el pie ("Continuar", "Registrar") queda justo arriba del teclado;
 * - en iPhone sin pie, el `ScrollView` ajusta sus márgenes al teclado y desplaza el campo enfocado a la vista
 *   (`automaticallyAdjustKeyboardInsets`, solo existe en iOS). No se combinan: los dos sumarían el alto del teclado.
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
  const conBarraNativa = useContext(HeaderShownContext);
  const bordesEfectivos = conBarraNativa ? bordes.filter((b) => b !== 'top') : bordes;
  const ios = Platform.OS === 'ios';
  const evitarTeclado = !ios || Boolean(pie) || !desplazable;
  const contenido: ViewStyle = { padding: margenPantalla, gap: espacio.xl };
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
            paddingTop: espacio.l,
            paddingBottom: espacio.m,
            gap: espacio.s,
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
    <SafeAreaView testID={testID} edges={bordesEfectivos} style={{ flex: 1, backgroundColor: c.fondo }}>
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
