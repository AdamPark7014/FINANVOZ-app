import { useState } from 'react';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { esFlujoLargo, PantallaFormularioLargo } from '../src/pantallas/asistente/PantallaFormularioLargo';
import { PantallaR2 } from '../src/pantallas/asistente/PantallaR2';
import {
  avisarDesdeRegistrar,
  avisarGuardadoR2,
  pedirAlAsistente,
  tomarPrellenadoR2,
} from '../src/pantallas/asistente/r2';

/**
 * `/registrar` (Ola 7): hoja modal R2 con lo dicho ya puesto (llega en memoria, `abrirR2`), o el formulario largo de
 * un flujo con `?flujo=msi|tanda|cuenta_dividida` («Cambiar algo», también en memoria). Los enlaces de antes siguen
 * funcionando: `?dictar=1` (micrófono del widget) y `?frase=<id>` («Revisar» en «Por revisar», solo el id, regla 9)
 * se pasan al asistente y se abre su pestaña.
 */
export default function Registrar() {
  const router = useRouter();
  const { frase, dictar, flujo } = useLocalSearchParams<{
    frase?: string;
    dictar?: string;
    flujo?: string;
  }>();
  // Una sola vez al abrir: lo que traiga la ruta va al asistente; si no, R2 o el formulario largo.
  const [destino] = useState<'asistente' | 'largo' | 'r2'>(() => {
    if (dictar === '1') {
      pedirAlAsistente({ tipo: 'dictar' });
      return 'asistente';
    }
    if (typeof frase === 'string' && frase !== '') {
      pedirAlAsistente({ tipo: 'revisar', frase });
      return 'asistente';
    }
    return esFlujoLargo(flujo) ? 'largo' : 'r2';
  });
  const [prellenado] = useState(() => (destino === 'r2' ? tomarPrellenadoR2() : null));
  if (destino === 'asistente') return <Redirect href="/hoy" />;
  const cerrar = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));
  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      {destino === 'largo' && esFlujoLargo(flujo) ? (
        <PantallaFormularioLargo
          flujo={flujo}
          alCerrar={cerrar}
          alResultado={(resultado) => avisarDesdeRegistrar({ tipo: 'resultado', resultado })}
          alMensaje={(mensaje) => avisarDesdeRegistrar({ tipo: 'mensaje', mensaje })}
        />
      ) : (
        <PantallaR2 prellenado={prellenado} alCerrar={cerrar} alGuardado={avisarGuardadoR2} />
      )}
    </>
  );
}
