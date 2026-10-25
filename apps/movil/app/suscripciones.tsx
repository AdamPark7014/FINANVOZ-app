import { Stack } from 'expo-router';
import { PantallaSuscripciones, TITULO_PANTALLA } from '../src/pantallas/suscripciones';
import { opcionesBarraNativa } from '../src/ui/navegacion';

/** Cuentas → Suscripciones (`02 §20`). */
export default function SuscripcionesRuta() {
  return (
    <>
      <Stack.Screen options={opcionesBarraNativa(TITULO_PANTALLA)} />
      <PantallaSuscripciones />
    </>
  );
}
