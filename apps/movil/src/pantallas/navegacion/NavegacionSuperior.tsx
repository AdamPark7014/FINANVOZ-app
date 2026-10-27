import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { espacio, margenPantalla, navegacionSuperior, useTema } from '../../ui';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_ACCESIBILIDAD_TU,
  ETIQUETA_PESTANA,
  ETIQUETA_SELECTOR_SECCIONES,
  PISTA_CIRCULO_TU,
  RUTAS_SEGMENTOS,
  TEST_ID_CIRCULO_TU,
  TEXTO_CIRCULO_TU,
  testIdBotonPestana,
  type RutaPestanaVisible,
} from '../../rutas/pestanas-textos';

/**
 * Navegación de arriba (dirección B, tablero B1; `02 §2`): el selector Asistente · Movimientos · Cuentas y el
 * círculo de Tú. Es la «barra de pestañas» del grupo `(tabs)` puesta arriba (`tabBarPosition: 'top'`): cambia de
 * pantalla sin perder lo que cada una tenía, y abajo queda solo la voz. El segmento elegido va en blanco con su
 * etiqueta en negritas (no solo cambia el color, `02 §15`); en Tú, el círculo se llena de pino.
 */
export function NavegacionSuperior({ state, navigation, insets }: BottomTabBarProps) {
  const { c, esquema } = useTema();
  // Con texto grande (más de 1.3×) las etiquetas no caben en tercios iguales: cada segmento mide lo que su texto y el
  // riel pasa al siguiente renglón en vez de cortarlas (`02 §15`, texto al 200 %).
  const grande = useWindowDimensions().fontScale > 1.3;
  const activa = state.routes[state.index]?.name as RutaPestanaVisible | undefined;

  const ir = (ruta: RutaPestanaVisible) => {
    const destino = state.routes.find((r) => r.name === ruta);
    if (!destino) return;
    const evento = navigation.emit({ type: 'tabPress', target: destino.key, canPreventDefault: true });
    if (activa !== ruta && !evento.defaultPrevented) navigation.navigate(destino.name, destino.params);
  };

  const enTu = activa === 'tu';
  const radioSegmento = navegacionSuperior.alto / 2 - 3;
  return (
    <View
      testID="navegacion-superior"
      style={{
        paddingTop: insets.top + navegacionSuperior.margenSuperior,
        paddingHorizontal: margenPantalla,
        paddingBottom: espacio.s,
        backgroundColor: c.fondo,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
      }}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel={ETIQUETA_SELECTOR_SECCIONES}
        style={{
          flex: 1,
          minHeight: navegacionSuperior.alto,
          borderRadius: navegacionSuperior.alto / 2,
          backgroundColor: c.segmento,
          flexDirection: 'row',
          flexWrap: grande ? 'wrap' : 'nowrap',
          padding: 3,
          gap: 2,
        }}
      >
        {RUTAS_SEGMENTOS.map((ruta) => {
          const elegido = activa === ruta;
          return (
            <Pressable
              key={ruta}
              testID={testIdBotonPestana(ruta)}
              onPress={() => ir(ruta)}
              accessibilityRole="tab"
              accessibilityLabel={ETIQUETA_ACCESIBILIDAD_PESTANA[ruta]}
              accessibilityState={{ selected: elegido }}
              // El segmento mide 42 dentro del riel de 48: el toque se amplía a 48.
              hitSlop={{ top: 3, bottom: 3, left: 0, right: 0 }}
              style={({ pressed }) => ({
                ...(grande ? { flexGrow: 1 } : { flex: 1 }),
                minHeight: navegacionSuperior.alto - 6,
                borderRadius: radioSegmento,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: espacio.xs,
                backgroundColor: elegido ? c.segmentoActivo : 'transparent',
                opacity: pressed && !elegido ? 0.7 : 1,
                ...(elegido && esquema === 'claro'
                  ? {
                      shadowColor: c.texto,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.14,
                      shadowRadius: 3,
                      elevation: 2,
                    }
                  : null),
              })}
            >
              <Text
                importantForAccessibility="no"
                style={{
                  ...navegacionSuperior.etiqueta,
                  fontWeight: elegido ? '700' : '600',
                  color: elegido ? c.texto : c.textoSecundario,
                }}
              >
                {ETIQUETA_PESTANA[ruta]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID={TEST_ID_CIRCULO_TU}
        onPress={() => ir('tu')}
        accessibilityRole="button"
        accessibilityLabel={ETIQUETA_ACCESIBILIDAD_TU}
        accessibilityHint={PISTA_CIRCULO_TU}
        accessibilityState={{ selected: enTu }}
        style={({ pressed }) => ({
          width: navegacionSuperior.alto,
          height: navegacionSuperior.alto,
          borderRadius: navegacionSuperior.alto / 2,
          backgroundColor: enTu ? c.acento : c.segmentoActivo,
          borderWidth: 1,
          borderColor: enTu ? c.acento : c.borde,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          importantForAccessibility="no"
          style={{ fontSize: 16, lineHeight: 20, fontWeight: '700', color: enTu ? c.sobreAcento : c.texto }}
        >
          {TEXTO_CIRCULO_TU}
        </Text>
      </Pressable>
    </View>
  );
}
