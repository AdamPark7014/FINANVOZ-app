import { Restaurar } from '../src/pantallas/respaldo/Restaurar';
import { espacio, Pantalla } from '../src/ui';
import { BarraNativa } from '../src/ui/navegacion';

/** Restaurar un respaldo `.cartera` (M9, `02 §19`): privacidad, respaldo o bienvenida en teléfono nuevo. */
export default function RestaurarRespaldo() {
  return (
    <>
      <BarraNativa salida="/" />
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
