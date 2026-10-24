import { Tabs, type BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { IconoPestana } from '../../src/pantallas/asistente/IconoPestana';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { estiloBarraPestanas, useTema } from '../../src/ui';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_PESTANA,
  testIdBotonPestana,
  type RutaPestanaVisible,
} from '../../src/rutas/pestanas-textos';

export { ETIQUETA_ACCESIBILIDAD_PESTANA } from '../../src/rutas/pestanas-textos';

function opcionesPestana(ruta: RutaPestanaVisible): BottomTabNavigationOptions {
  const etiqueta = ETIQUETA_PESTANA[ruta];
  return {
    title: etiqueta,
    tabBarLabel: etiqueta,
    tabBarButtonTestID: testIdBotonPestana(ruta),
    tabBarAccessibilityLabel: ETIQUETA_ACCESIBILIDAD_PESTANA[ruta],
    tabBarIcon: ({ color }) => <IconoPestana ruta={ruta} color={color} />,
  };
}

/**
 * Cuatro pestañas (Ola 7 §2): Asistente (ruta `hoy`) · Movimientos · Cuentas · Tú. Registrar ya no es pestaña:
 * `/registrar` es la hoja modal R2 (`app/registrar.tsx`). El aviso con "Deshacer" vive aquí para sobrevivir al
 * cambio de pantalla.
 */
export default function LayoutPestanas() {
  const { c, esquema } = useTema();
  return (
    <ProveedorAvisos sobrePestanas>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.fondo },
          tabBarAllowFontScaling: true,
          ...estiloBarraPestanas(c, esquema),
        }}
      >
        <Tabs.Screen name="hoy" options={opcionesPestana('hoy')} />
        <Tabs.Screen name="movimientos" options={opcionesPestana('movimientos')} />
        <Tabs.Screen name="cuentas" options={opcionesPestana('cuentas')} />
        <Tabs.Screen name="tu" options={opcionesPestana('tu')} />
      </Tabs>
    </ProveedorAvisos>
  );
}
