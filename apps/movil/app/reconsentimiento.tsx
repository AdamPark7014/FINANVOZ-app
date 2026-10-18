import { Stack } from 'expo-router';
import { Reconsentimiento } from '../src/pantallas/privacidad/Reconsentimiento';
import { useControlApp } from '../src/sesion/ControlApp';

/** Si el aviso aceptado va atrás de la versión actual: aceptar, solo lectura o borrar todo (`08`). */
export default function ReconsentimientoRuta() {
  const control = useControlApp();
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
          title: 'Actualizamos el aviso de privacidad',
        }}
      />
      <Reconsentimiento alBorrarTodo={() => control.borrarTodo()} />
    </>
  );
}
