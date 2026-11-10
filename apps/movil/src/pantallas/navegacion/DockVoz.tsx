import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useContext, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { dockVoz, espacio, Icono, useTema, type NombreIcono } from '../../ui';

/** Un botón lateral del dock: «Escribir», «¿Me alcanza?», «Buscar» o «Agregar». */
export interface BotonDock {
  /** Texto visible (corto: cabe en 118 pt). */
  readonly etiqueta: string;
  readonly icono?: NombreIcono;
  readonly alPresionar: () => void;
  readonly testID: string;
  /** Nombre para el lector si difiere del visible («Cerrar el teclado»). */
  readonly etiquetaAccesible?: string;
  readonly pista?: string;
  /** Abre algo en la pantalla (campo, búsqueda, menú): el lector dice si está abierto. */
  readonly abierto?: boolean;
}

/**
 * Distancia del dock al borde de abajo: 22 pt en un iPhone con indicador de inicio (34 − 12, tablero B1) y nunca
 * menos de 12. Sin `SafeAreaProvider` (pruebas de una pantalla) cuenta como 0 de área segura.
 */
export function useMedidasDock(): { abajo: number; ocupado: number } {
  const inferior = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const abajo = Math.max(espacio.m, inferior - espacio.m);
  // Lo que tapa el dock al pie de una lista: su alto, su margen y un respiro para que lo último no quede pegado.
  return { abajo, ocupado: dockVoz.alto + abajo + espacio.l };
}

/**
 * Dock de voz (`02 §2`, premium 08-11): «Escribir» a la izquierda, el micrófono al centro y la acción de la pantalla a
 * la derecha, sobre cristal de iOS 26 (en otros teléfonos, una superficie con filo). Objetivos de 52 y 68 pt; con texto
 * grande la etiqueta pasa a dos renglones y el dock crece, nunca se corta (`02 §15`).
 */
export function DockVoz({
  izquierda,
  centro,
  derecha,
  style,
  testID = 'dock-voz',
}: {
  izquierda: BotonDock;
  centro: ReactNode;
  derecha: BotonDock;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { c, esquema } = useTema();
  const cristal = Platform.OS === 'ios' && isLiquidGlassAvailable();
  return (
    <View
      testID={testID}
      style={[
        {
          minHeight: dockVoz.alto,
          borderRadius: dockVoz.radio,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
          paddingHorizontal: 10,
          paddingVertical: espacio.xs,
        },
        cristal ? null : { backgroundColor: c.superficie, borderWidth: 1, borderColor: c.borde },
        style,
      ]}
    >
      {cristal ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={esquema === 'oscuro' ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: dockVoz.radio }]}
        />
      ) : null}
      <BotonLateral boton={izquierda} />
      {centro}
      <BotonLateral boton={derecha} />
    </View>
  );
}

function BotonLateral({ boton }: { boton: BotonDock }) {
  const { c } = useTema();
  const abierto = boton.abierto === true;
  return (
    <Pressable
      testID={boton.testID}
      onPress={boton.alPresionar}
      accessibilityRole="button"
      accessibilityLabel={boton.etiquetaAccesible ?? boton.etiqueta}
      {...(boton.pista ? { accessibilityHint: boton.pista } : {})}
      {...(boton.abierto !== undefined ? { accessibilityState: { expanded: abierto } } : {})}
      style={({ pressed }) => ({
        width: dockVoz.anchoBoton,
        flexShrink: 1,
        minHeight: dockVoz.altoBoton,
        borderRadius: dockVoz.altoBoton / 2,
        // Abierto: un filo (la forma cambia, no solo el color, `02 §15`).
        borderWidth: abierto ? 1.5 : 0,
        borderColor: c.acentoTexto,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: espacio.xs + 2,
        paddingHorizontal: espacio.s,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {boton.icono ? <Icono nombre={boton.icono} color={c.texto} tamano={18} grosor={1.8} /> : null}
      <Text
        importantForAccessibility="no"
        style={{ ...dockVoz.etiqueta, fontWeight: '500', color: c.texto, flexShrink: 1 }}
      >
        {boton.etiqueta}
      </Text>
    </Pressable>
  );
}
