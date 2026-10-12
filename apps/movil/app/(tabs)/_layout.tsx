import { Tabs } from 'expo-router/js-tabs';
import { IconoPestana, ProveedorAvisos } from '../../src/pantallas/principal';
import { barraPestanas, estiloBarraPestanas, useTema } from '../../src/ui';

const etiqueta = (ruta: string) => barraPestanas.pestanas.find((p) => p.ruta === ruta)?.etiqueta ?? ruta;

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
            title: etiqueta('hoy'),
            tabBarButtonTestID: 'pestana-hoy',
            tabBarIcon: ({ color }) => <IconoPestana ruta="hoy" color={color} />,
          }}
        />
        <Tabs.Screen
          name="movimientos"
          options={{
            title: etiqueta('movimientos'),
            tabBarButtonTestID: 'pestana-movimientos',
            tabBarIcon: ({ color }) => <IconoPestana ruta="movimientos" color={color} />,
          }}
        />
        <Tabs.Screen
          name="cuentas"
          options={{
            title: etiqueta('cuentas'),
            tabBarButtonTestID: 'pestana-cuentas',
            tabBarIcon: ({ color }) => <IconoPestana ruta="cuentas" color={color} />,
          }}
        />
        <Tabs.Screen name="registrar" options={{ href: null, title: 'Registrar' }} />
      </Tabs>
    </ProveedorAvisos>
  );
}
