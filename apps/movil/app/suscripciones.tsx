import { PantallaSuscripciones } from '../src/pantallas/suscripciones';
import { BarraNativa } from '../src/ui/navegacion';

/** Cuentas → Suscripciones (`02 §20`). */
export default function SuscripcionesRuta() {
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <PantallaSuscripciones />
    </>
  );
}
