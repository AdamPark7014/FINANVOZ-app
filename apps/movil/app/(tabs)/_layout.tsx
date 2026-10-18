import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { IconoPestana, ProveedorAvisos } from '../../src/pantallas/principal';
import { barraPestanas, estiloBarraPestanas, useTema } from '../../src/ui';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  testIdBotonPestana,
  type RutaPestanaVisible,
} from './pestanas-textos';

export { ETIQUETA_ACCESIBILIDAD_PESTANA } from './pestanas-textos';

function opcionesPestana(ruta: RutaPestanaVisible): BottomTabNavigationOptions {
  const { etiqueta } = barraPestanas.pestanas.find((p) => p.ruta === ruta)!;
  return {
    title: etiqueta,
    tabBarLabel: etiqueta,
    tabBarButtonTestID: testIdBotonPestana(ruta),
    tabBarAccessibilityLabel: ETIQUETA_ACCESIBILIDAD_PESTANA[ruta],
    tabBarIcon: ({ color }) => <IconoPestana ruta={ruta} color={color} />,
  };
}

/**
 * Tres pestañas: Hoy · Movimientos · Cuentas (02-UX §2). "Registrar" (dictado, texto y formulario) es una ruta
 * de este grupo sin pestaña propia: se abre desde el botón de voz de Hoy y desde Movimientos. El aviso con
 * "Deshacer" vive aquí para sobrevivir al cambio de pantalla.
 */
export default function LayoutPestanas() {
  const { c } = useTema();
  return (
    <ProveedorAvisos sobrePestanas>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.fondo },
          tabBarAllowFontScaling: true,
          ...estiloBarraPestanas(c),
        }}
      >
        <Tabs.Screen name="hoy" options={opcionesPestana('hoy')} />
        <Tabs.Screen name="movimientos" options={opcionesPestana('movimientos')} />
        <Tabs.Screen name="cuentas" options={opcionesPestana('cuentas')} />
        <Tabs.Screen
          name="registrar"
          options={{ href: null, title: 'Registrar', tabBarLabel: 'Registrar' }}
        />
      </Tabs>
    </ProveedorAvisos>
  );
}
