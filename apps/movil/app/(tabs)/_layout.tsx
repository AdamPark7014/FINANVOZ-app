import { Tabs } from 'expo-router/js-tabs';
import { IconoPestana, ProveedorAvisos } from '../../src/pantallas/principal';
import { estiloBarraPestanas, useTema } from '../../src/ui';

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
          ...estiloBarraPestanas(c),
        }}
      >
        <Tabs.Screen
          name="hoy"
          options={{
            title: 'Hoy',
            tabBarLabel: 'Hoy',
            tabBarButtonTestID: 'pestana-hoy',
            tabBarIcon: ({ color }) => <IconoPestana ruta="hoy" color={color} />,
          }}
        />
        <Tabs.Screen
          name="movimientos"
          options={{
            title: 'Movimientos',
            tabBarLabel: 'Movimientos',
            tabBarButtonTestID: 'pestana-movimientos',
            tabBarIcon: ({ color }) => <IconoPestana ruta="movimientos" color={color} />,
          }}
        />
        <Tabs.Screen
          name="cuentas"
          options={{
            title: 'Cuentas',
            tabBarLabel: 'Cuentas',
            tabBarButtonTestID: 'pestana-cuentas',
            tabBarIcon: ({ color }) => <IconoPestana ruta="cuentas" color={color} />,
          }}
        />
        <Tabs.Screen
          name="registrar"
          options={{ href: null, title: 'Registrar', tabBarLabel: 'Registrar' }}
        />
      </Tabs>
    </ProveedorAvisos>
  );
}
