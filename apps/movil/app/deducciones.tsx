import { Stack } from 'expo-router';
import { PantallaDeducciones } from '../src/pantallas/deducciones';
import { archivosFacturasExpo } from '../src/pantallas/deducciones/expo';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Personal → Deducciones (`02 §24`): desde Cuentas y desde "Ver mis deducciones" al importar. */
export default function DeduccionesRuta() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa('Deducciones')} />
      <PantallaDeducciones archivos={archivosFacturasExpo} />
    </>
  );
}
