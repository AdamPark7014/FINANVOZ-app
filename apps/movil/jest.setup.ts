import { configure } from '@testing-library/react-native';
import { Animated } from 'react-native';

// Los botones y avisos esconden su texto interno a TalkBack (lo anuncia la etiqueta del contenedor);
// las pruebas siguen buscando ese texto visible, así que las consultas incluyen elementos ocultos.
configure({ defaultIncludeHiddenElements: true });

// Las animaciones infinitas (el orbe que respira, sus ondas, la onda de voz y «pensando») no corren en las pruebas:
// solo gastarían CPU en cada pantalla del asistente y nada las mide. Las finitas (entrada de turnos, la barra del día)
// sí corren. Se asigna sin `jest.spyOn` para que `restoreAllMocks` de una prueba no las vuelva a encender.
Animated.loop = (() => ({
  start: () => {},
  stop: () => {},
  reset: () => {},
})) as unknown as typeof Animated.loop;
