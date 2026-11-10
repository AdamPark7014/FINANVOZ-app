import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { FUENTE, espacio, heroeDia, margenPantalla, navegacionSuperior, useTema } from '../../ui';
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
import { useTonoNavegacion } from './TonoNavegacion';

/**
 * Navegación de arriba (`02 §2`, premium 08-11): Asistente · Movimientos · Cuentas como texto y el círculo de Tú. Es
 * la «barra de pestañas» del grupo `(tabs)` puesta arriba (`tabBarPosition: 'top'`). La elegida va en negritas con una
 * rayita abajo (no solo cambia el color, `02 §15`); en Tú, el círculo se llena de pino. En Inicio en reposo se funde
 * con la placa verde (`useHeroeEnNavegacion`). Con texto grande, las etiquetas pasan al siguiente renglón.
 */
export function NavegacionSuperior({ state, navigation, insets }: BottomTabBarProps) {
  const { c, esquema } = useTema();
  const activa = state.routes[state.index]?.name as RutaPestanaVisible | undefined;
  const tono = useTonoNavegacion();
  const heroe = tono === 'heroe' && activa === 'hoy';
  const h = heroeDia[esquema];
  const fondo = heroe ? h.fondo : c.fondo;
  const elegidoColor = heroe ? h.texto : c.texto;
  const restoColor = heroe ? h.textoSecundario : c.textoSecundario;

  const ir = (ruta: RutaPestanaVisible) => {
    const destino = state.routes.find((r) => r.name === ruta);
    if (!destino) return;
    const evento = navigation.emit({ type: 'tabPress', target: destino.key, canPreventDefault: true });
    if (activa !== ruta && !evento.defaultPrevented) navigation.navigate(destino.name, destino.params);
  };

  const enTu = activa === 'tu';
  return (
    <View
      testID="navegacion-superior"
      style={{
        paddingTop: insets.top + navegacionSuperior.margenSuperior,
        paddingHorizontal: espacio.xl,
        paddingBottom: espacio.xs,
        backgroundColor: fondo,
        flexDirection: 'row',
        alignItems: 'center',
        gap: margenPantalla,
      }}
    >
      {heroe ? <StatusBar style="light" /> : null}
      <View
        accessibilityRole="tablist"
        accessibilityLabel={ETIQUETA_SELECTOR_SECCIONES}
        style={{
          flex: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: espacio.xl - espacio.xs,
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
              style={({ pressed }) => ({
                minHeight: navegacionSuperior.alto,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed && !elegido ? 0.7 : 1,
              })}
            >
              <Text
                importantForAccessibility="no"
                style={{
                  ...navegacionSuperior.etiqueta,
                  fontWeight: elegido ? '600' : '500',
                  color: elegido ? elegidoColor : restoColor,
                }}
              >
                {ETIQUETA_PESTANA[ruta]}
              </Text>
              <View
                style={{
                  position: 'absolute',
                  bottom: espacio.xs,
                  width: 16,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: elegido ? elegidoColor : 'transparent',
                }}
              />
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
          backgroundColor: enTu ? c.acento : 'transparent',
          borderWidth: 1,
          borderColor: enTu ? c.acento : heroe ? h.linea : c.borde,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          importantForAccessibility="no"
          style={{
            fontFamily: FUENTE,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '500',
            color: enTu ? c.sobreAcento : elegidoColor,
          }}
        >
          {TEXTO_CIRCULO_TU}
        </Text>
      </Pressable>
    </View>
  );
}
