import { Tabs, type BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { NavegacionSuperior } from '../../src/pantallas/navegacion/NavegacionSuperior';
import { ProveedorAvisos } from '../../src/pantallas/principal';
import { useTema } from '../../src/ui';
import {
  ETIQUETA_ACCESIBILIDAD_PESTANA,
  ETIQUETA_PESTANA,
  type RutaPestanaVisible,
} from '../../src/rutas/pestanas-textos';

export { ETIQUETA_ACCESIBILIDAD_PESTANA } from '../../src/rutas/pestanas-textos';

function opcionesPestana(ruta: RutaPestanaVisible): BottomTabNavigationOptions {
  return { title: ETIQUETA_PESTANA[ruta], tabBarAccessibilityLabel: ETIQUETA_ACCESIBILIDAD_PESTANA[ruta] };
}

/**
 * Dirección B (`02 §2`): la navegación va arriba (`NavegacionSuperior`: el selector Asistente · Movimientos · Cuentas
 * y el círculo de Tú) y abajo nunca hay pestañas; ahí vive el dock de voz de cada pantalla. Registrar no es pestaña:
 * `/registrar` es la hoja modal R2 (`app/registrar.tsx`). El aviso con "Deshacer" vive aquí para sobrevivir al
 * cambio de pantalla; los docks le reservan su espacio (`useReservarEspacioAviso`).
 */
export default function LayoutPestanas() {
  const { c } = useTema();
  return (
    <ProveedorAvisos>
      <Tabs
        backBehavior="history"
        tabBar={(props) => <NavegacionSuperior {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarPosition: 'top',
          sceneStyle: { backgroundColor: c.fondo },
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
