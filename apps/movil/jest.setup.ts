import { configure } from '@testing-library/react-native';
import { Animated } from 'react-native';

// Los botones y avisos esconden su texto interno a TalkBack (lo anuncia la etiqueta del contenedor);
// las pruebas siguen buscando ese texto visible, así que las consultas incluyen elementos ocultos.
configure({ defaultIncludeHiddenElements: true });

// El orbe de «Te escucho» dibuja con Skia y Reanimated, que no existen en las pruebas: aquí es una vista con su testID.
jest.mock('./src/ui/componentes/OrbeVivo', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { OrbeVivo: ({ testID }: { testID?: string }) => createElement(View, { testID }) };
});

// Las animaciones infinitas (el orbe que respira, sus ondas, la onda de voz y «pensando») no corren en las pruebas:
// solo gastarían CPU en cada pantalla del asistente y nada las mide. Las finitas (entrada de turnos, la barra del día)
// sí corren. Se asigna sin `jest.spyOn` para que `restoreAllMocks` de una prueba no las vuelva a encender.
Animated.loop = (() => ({
  start: () => {},
  stop: () => {},
  reset: () => {},
})) as unknown as typeof Animated.loop;
