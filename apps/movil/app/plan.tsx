import { PantallaPlan } from '../src/pantallas/plan';
import { BarraNativa } from '../src/ui/navegacion';

/** Plan Gratis / Plus (RF-PAG-01): desde Ajustes → Plan o desde un candado "· Plus". */
export default function Plan() {
  return (
    <>
      <BarraNativa salida="/hoy" />
      <PantallaPlan />
    </>
  );
}
