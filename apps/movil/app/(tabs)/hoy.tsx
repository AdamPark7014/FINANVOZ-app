import { useContext } from 'react';
import { useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { dependenciasCompartidoExpo } from '../../src/compartido/expo';
import { ProveedorCompartido } from '../../src/compartido/ProveedorCompartido';
import { useConfirmacionAlVolver } from '../../src/pantallas/ajustes/confirmacion';
import { abrirArqueo } from '../../src/pantallas/arqueo';
import { PantallaAsistente } from '../../src/pantallas/asistente/PantallaAsistente';
import { abrirR2 } from '../../src/pantallas/asistente/r2';
import { abrirMeAlcanza } from '../../src/pantallas/me-alcanza';
import { paramsDeDetalle, paramsDeFiltro, useMostrarAviso } from '../../src/pantallas/principal';
import { useInformarAltoPestanas } from '../../src/pantallas/principal/ProveedorAvisos';
import { propsContenedorPestana } from '../../src/rutas/pestanas-textos';

/**
 * Pestaña Asistente (Ola 7): la ruta sigue siendo `hoy` para los enlaces, el widget y Maestro. «Cambiar» y la
 * reparación abren R2 (`/registrar`, modal) con lo dicho en memoria (regla 9).
 */
export default function Hoy() {
  const router = useRouter();
  const mostrarAviso = useMostrarAviso();
  // El aviso con "Deshacer" se coloca sobre la barra real (en iPhone mide más que el token, `ProveedorAvisos`).
  useInformarAltoPestanas(useContext(BottomTabBarHeightContext));
  // "Listo: guardé tu ingreso…" al regresar de Ajustes › Ingreso.
  useConfirmacionAlVolver((mensaje) => mostrarAviso({ mensaje }));
  return (
    // Un gasto compartido dictado se confirma aquí mismo (`02 §27`).
    <View style={{ flex: 1 }} {...propsContenedorPestana('hoy')}>
      <ProveedorCompartido deps={dependenciasCompartidoExpo()}>
        <PantallaAsistente
          navegacion={{
            alVerMovimientos: (filtro) =>
              router.navigate({ pathname: '/movimientos', params: filtro ? paramsDeFiltro(filtro) : {} }),
            alVerMovimiento: (transaccionId) =>
              router.navigate({ pathname: '/movimientos', params: paramsDeDetalle(transaccionId) }),
            // Directo a Ajustes › Ingreso (02-UX §12); al guardar regresa aquí.
            alConfigurarIngreso: () => router.push('/ajustes/ingreso'),
            alAbrirFormulario: () => abrirR2(router),
            alAbrirR2: (prellenado) => abrirR2(router, prellenado),
            alAbrirArqueo: (efectivoReal) =>
              abrirArqueo(router, efectivoReal !== undefined ? { efectivoReal } : {}),
            alAbrirMeAlcanza: (consulta) => abrirMeAlcanza(router, consulta),
            alAbrirAjustes: () => router.push('/ajustes'),
            alAbrirRuta: (ruta) => router.push(ruta as Parameters<typeof router.push>[0]),
          }}
        />
      </ProveedorCompartido>
    </View>
  );
}
