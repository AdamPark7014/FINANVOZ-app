import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { etiquetaHablada } from '../formato';
import { useTema } from '../tema';
import { espacio, OBJETIVO_TACTIL_MIN } from '../tokens';

export type VariantePildora = 'contorno' | 'lleno' | 'suave';

/**
 * Botón en píldora de la dirección B (`docs/diseno/direccion-b/`): las respuestas de un toque del asistente («Ya la
 * pagué», «Todavía no»), «Lo compré» y «Deshacer». `contorno`: fondo de tarjeta con filo pino de 1.5; `lleno`: pino
 * con texto blanco; `suave`: relleno gris verdoso. 44 pt de alto como en los tableros, con el toque ampliado a 48.
 */
export function BotonPildora({
  etiqueta,
  alPresionar,
  variante = 'contorno',
  pista,
  etiquetaAccesible,
  deshabilitado = false,
  cargando = false,
  icono,
  ancho = 'contenido',
  alto = 44,
  testID,
  style,
}: {
  etiqueta: string;
  alPresionar: () => void;
  variante?: VariantePildora;
  pista?: string;
  etiquetaAccesible?: string;
  deshabilitado?: boolean;
  cargando?: boolean;
  /** Algo a la izquierda del texto (el anillo de «Deshacer»). */
  icono?: ReactNode;
  /** `contenido` se ajusta al texto; `lleno` ocupa lo que le dé su fila (`flex: 1`). */
  ancho?: 'contenido' | 'lleno';
  alto?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTema();
  const inactivo = deshabilitado || cargando;
  const fondo = variante === 'lleno' ? c.acento : variante === 'suave' ? c.superficieAlterna : c.superficie;
  const tinta = variante === 'lleno' ? c.sobreAcento : c.acento;
  const extra = Math.max(0, (OBJETIVO_TACTIL_MIN - alto) / 2);
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      onPress={inactivo ? undefined : alPresionar}
      disabled={inactivo}
      hitSlop={{ top: extra, bottom: extra, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiquetaHablada(etiqueta)}
      {...(pista ? { accessibilityHint: pista } : {})}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        {
          minHeight: alto,
          borderRadius: alto / 2,
          paddingHorizontal: 18,
          backgroundColor: fondo,
          borderWidth: variante === 'contorno' ? 1.5 : 0,
          borderColor: c.acento,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espacio.s,
          opacity: deshabilitado ? 0.45 : pressed ? 0.8 : 1,
        },
        ancho === 'lleno' ? { flex: 1 } : { alignSelf: 'flex-start' },
        style,
      ]}
    >
      {cargando ? <ActivityIndicator size="small" color={tinta} /> : icono ? <View>{icono}</View> : null}
      <Text
        importantForAccessibility="no"
        style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: tinta, textAlign: 'center' }}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}
