import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { useConfirmacionAlVolver } from '../../src/pantallas/ajustes/confirmacion';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { PantallaHoy, paramsDeDetalle, paramsDeFiltro, useMostrarAviso } from '../../src/pantallas/principal';
import { TEST_ID_TAB_HOY } from './hoy-textos';

export default function Hoy() {
  const router = useRouter();
  const mostrarAviso = useMostrarAviso();
  // "Listo: guardé tu ingreso…" al regresar de Ajustes › Ingreso.
  useConfirmacionAlVolver((mensaje) => mostrarAviso({ mensaje }));
  return (
    // Un gasto compartido dictado se confirma aquí mismo (`02 §27`).
    <View style={{ flex: 1 }} testID={TEST_ID_TAB_HOY}>
      <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
        <PantallaHoy
        navegacion={{
          alVerMovimientos: (filtro) =>
            router.navigate({ pathname: '/movimientos', params: filtro ? paramsDeFiltro(filtro) : {} }),
          alVerMovimiento: (transaccionId) =>
            router.navigate({ pathname: '/movimientos', params: paramsDeDetalle(transaccionId) }),
          // Directo a Ajustes › Ingreso (02-UX §12); al guardar regresa aquí.
          alConfigurarIngreso: () => router.push('/ajustes/ingreso'),
          alAbrirFormulario: () => router.navigate('/registrar'),
          alAbrirArqueo: (efectivoReal) =>
            abrirArqueo(router, efectivoReal !== undefined ? { efectivoReal } : {}),
          alAbrirMeAlcanza: (consulta) => abrirMeAlcanza(router, consulta),
        }}
        />
      </ProveedorCompartido>
    </View>
  );
}