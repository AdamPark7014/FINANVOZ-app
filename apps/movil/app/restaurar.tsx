import { Stack, useRouter } from 'expo-router';
import { Restaurar } from '../src/pantallas/respaldo/Restaurar';
import { TITULO_RESTAURAR } from '../src/pantallas/respaldo/textos';
import { espacio, Pantalla } from '../src/ui';

/** Restaurar un respaldo `.cartera` (M9, `02 §19`): privacidad, respaldo o bienvenida en teléfono nuevo. */
export default function RestaurarRespaldo() {
  const router = useRouter();
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/onboarding'));
  return (
    <>
      <Stack.Screen options={{ title: TITULO_RESTAURAR, headerShown: false }} />
      <Pantalla
        testID="restaurar"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <Restaurar alVolver={volver} />
      </Pantalla>
    </>
  );
}
