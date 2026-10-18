import { Stack } from 'expo-router';
import { Reconsentimiento } from '../src/pantallas/privacidad/Reconsentimiento';
import { useControlApp } from '../src/sesion/ControlApp';

/** Reconsentimiento cuando sube `VERSION_CONSENTIMIENTO` (pendiente 31). */
export default function ReconsentimientoRuta() {
  const control = useControlApp();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Reconsentimiento alBorrarTodo={() => control.borrarTodo()} />
    </>
  );
}
