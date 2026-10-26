import { PantallaDeducciones } from '../src/pantallas/deducciones';
import { archivosFacturasExpo } from '../src/pantallas/deducciones/expo';
import { BarraNativa } from '../src/ui/navegacion';

/** Personal → Deducciones (`02 §24`): desde Cuentas y desde "Ver mis deducciones" al importar. */
export default function DeduccionesRuta() {
  return (
    <>
      <BarraNativa salida="/cuentas" />
      <PantallaDeducciones archivos={archivosFacturasExpo} />
    </>
  );
}
