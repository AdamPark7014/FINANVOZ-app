import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
// Archivos sueltos de voz/ (no su índice): ui/ no arrastra el reconocedor ni la voz del teléfono.
import { ETIQUETA_ESCUCHANDO, PISTA_ESCUCHANDO, TEXTO_DIMELO, TEXTO_TERMINAR } from '../../voz/textos';
import type { BotonHablar } from '../../voz/useBotonHablar';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN, radio, tipo } from '../tokens';
import { Texto } from './Texto';

export interface BotonMicrofonoProps {
  /** `icono`: 48 dp junto a un campo. `boton`: pastilla con texto ("Dímelo", "Toca para hablar"). */
  forma: 'icono' | 'boton';
  escuchando: boolean;
  /** Manejadores de `useMicrofono().boton`. */
  boton: BotonHablar;
  /** Nombre para el lector mientras no escucha (sin cifras). */
  etiqueta: string;
  /** Qué pasa al tocarlo, mientras no escucha. */
  pista: string;
  /** Texto visible de la forma `boton`; por omisión "Dímelo". */
  texto?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Micrófono de dictado (02-UX §5): toca para hablar y toca para terminar, mantener y soltar, y el doble
 * toque de TalkBack/VoiceOver como acción "activar". Escuchando, cambia la etiqueta y la forma (no solo el
 * color, 02-UX §15).
 */
export function BotonMicrofono({
  forma,
  escuchando,
  boton,
  etiqueta,
  pista,
  texto = TEXTO_DIMELO,
  style,
  testID,
}: BotonMicrofonoProps) {
  const { c } = useTema();
  const enIcono = forma === 'icono';
  const fondo = enIcono && !escuchando ? c.superficie : c.acento;
  const tinta = enIcono && !escuchando ? c.acentoTexto : c.sobreAcento;
  return (
    <Pressable
      {...(testID === undefined ? {} : { testID })}
      onPressIn={boton.alPresionarDentro}
      onPressOut={boton.alSoltar}
      accessibilityActions={boton.accionesAccesibles}
      onAccessibilityAction={boton.alAccionAccesible}
      accessibilityRole="button"
      accessibilityLabel={escuchando ? ETIQUETA_ESCUCHANDO : etiqueta}
      accessibilityHint={escuchando ? PISTA_ESCUCHANDO : pista}
      style={({ pressed }) => [
        enIcono
          ? {
              width: OBJETIVO_TACTIL_MIN,
              height: OBJETIVO_TACTIL_MIN,
              borderRadius: radio.pastilla,
              borderWidth: escuchando ? 0 : 1,
              borderColor: c.bordeControl,
            }
          : {
              minHeight: OBJETIVO_TACTIL_MIN + espacio.s,
              borderRadius: radio.pastilla,
              flexDirection: 'row' as const,
              gap: espacio.s,
              paddingHorizontal: espacio.l,
            },
        {
          backgroundColor: fondo,
          opacity: pressed ? 0.85 : 1,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        style,
      ]}
    >
      {enIcono && escuchando ? <IconoDetener color={tinta} /> : <IconoMicrofono color={tinta} />}
      {enIcono ? null : (
        <Texto
          style={[tipo.etiqueta, { fontSize: 16, color: tinta }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {escuchando ? TEXTO_TERMINAR : texto}
        </Texto>
      )}
    </Pressable>
  );
}

/** Ícono de micrófono dibujado con vistas (sin dependencias de íconos). */
export function IconoMicrofono({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: 'center' }}
    >
      <View style={{ width: 10, height: 15, borderRadius: 5, backgroundColor: color }} />
      <View
        style={{
          width: 16,
          height: 8,
          marginTop: -4,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
      <View style={{ width: 2, height: 3, backgroundColor: color }} />
    </View>
  );
}

/** Cuadro de "terminar" mientras escucha (el micrófono de campo cambia de forma, no solo de color). */
function IconoDetener({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 14, height: 14, borderRadius: radio.s / 2, backgroundColor: color }}
    />
  );
}
