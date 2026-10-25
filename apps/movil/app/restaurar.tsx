import { Stack } from 'expo-router';
import { Restaurar } from '../src/pantallas/respaldo/Restaurar';
import { TITULO_RESTAURAR } from '../src/pantallas/respaldo/textos';
import { espacio, Pantalla } from '../src/ui';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Restaurar un respaldo `.cartera` (M9, `02 §19`): privacidad, respaldo o bienvenida en teléfono nuevo. */
export default function RestaurarRespaldo() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_RESTAURAR)} />
      <Pantalla
        testID="restaurar"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <Restaurar />
      </Pantalla>
    </>
  );
}
