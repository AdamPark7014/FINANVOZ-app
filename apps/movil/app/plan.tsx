import { Stack } from 'expo-router';
import { PantallaPlan, TITULO_PANTALLA } from '../src/pantallas/plan';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Plan Gratis / Plus (RF-PAG-01): desde Ajustes → Plan o desde un candado "· Plus". */
export default function Plan() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PANTALLA)} />
      <PantallaPlan />
    </>
  );
}
