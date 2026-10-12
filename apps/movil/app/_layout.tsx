import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { crearNivelNubeExpo } from '../src/nube/expo';
import { useProcesarCola } from '../src/nube/useProcesarCola';
import { iniciarSentry } from '../src/observabilidad';
import { crearNotificacionesExpo } from '../src/pantallas/avisos/expo';
import { ProveedorNotificaciones, SincronizarAvisosTarjetas } from '../src/pantallas/avisos/notificaciones';
import { CortinaBloqueo, useBloqueo, useOcultarEnMultitarea } from '../src/seguridad';
import { cargarEscenario, obtenerBloqueo, relojFijo } from '../src/servicios';
import { abrirSesion, borrarTodoApp, type Sesion } from '../src/servicios/sesion';
import { ProveedorControlApp, type ControlApp } from '../src/sesion/ControlApp';
import { ProveedorSesion, useVista } from '../src/sesion/ProveedorSesion';
import { Boton, Pantalla, Texto, useTema } from '../src/ui';

iniciarSentry();

type Estado =
  | { tipo: 'lista'; sesion: Sesion; generacion: number }
  | { tipo: 'trabajando'; generacion: number }
  | { tipo: 'error'; generacion: number };

/** Abre la base cifrada; si falla, la raíz muestra una pantalla amable con "Intentar de nuevo". */
function intentarAbrir(generacion: number, preparar?: () => Sesion): Estado {
  try {
    return { tipo: 'lista', sesion: preparar ? preparar() : abrirSesion(), generacion };
  } catch {
    // El error no se muestra ni se registra con detalle: podría llevar rutas o datos (regla 9).
    return { tipo: 'error', generacion };
  }
}

export default function Raiz() {
  const { esquema } = useTema();
  const [estado, setEstado] = useState<Estado>(() => intentarAbrir(0));
  const sesion = estado.tipo === 'lista' ? estado.sesion : null;
  // Nivel 2 del intérprete; `null` si la build no trae `supabaseUrl` y `supabaseAnonKey` en `extra`.
  const nube = useMemo(() => crearNivelNubeExpo(), []);
  // Avisos locales de corte y fecha límite (`02 §13`); nada de push.
  const notificaciones = useMemo(() => crearNotificacionesExpo(), []);

  const reemplazarSesion = useCallback(
    async (preparar?: () => Sesion) => {
      const siguiente = estado.generacion + 1;
      setEstado({ tipo: 'trabajando', generacion: siguiente });
      try {
        await borrarTodoApp(sesion);
      } catch {
        setEstado({ tipo: 'error', generacion: siguiente });
        return;
      }
      setEstado(intentarAbrir(siguiente, preparar));
    },
    [estado.generacion, sesion],
  );

  const control = useMemo<ControlApp>(
    () => ({
      borrarTodo: () => reemplazarSesion(),
      ...(__DEV__
        ? {
            cargarEscenario: (datos: unknown) =>
              reemplazarSesion(() => {
                // El reloj se fija en el `hoy` del escenario hasta el próximo arranque en frío.
                const hoy = (datos as { hoy: string }).hoy;
                const nueva = abrirSesion(relojFijo(hoy, Date.now()));
                try {
                  cargarEscenario(nueva.ctx, datos);
                } catch (error) {
                  nueva.base.cerrar();
                  throw error;
                }
                return nueva;
              }),
          }
        : {}),
    }),
    [reemplazarSesion],
  );

  if (estado.tipo !== 'lista') {
    return (
      <Pantalla testID="raiz-sin-sesion" bordes={['top', 'left', 'right', 'bottom']}>
        <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
        {estado.tipo === 'trabajando' ? (
          <Texto variante="cuerpo" tono="secundario">
            Un momento…
          </Texto>
        ) : (
          <>
            <Texto variante="titulo">No pude abrir tus datos</Texto>
            <Texto variante="cuerpo" tono="secundario">
              Cierra la app y vuelve a abrirla. Si sigue pasando, reinicia el teléfono.
            </Texto>
            <Boton
              etiqueta="Intentar de nuevo"
              alPresionar={() => setEstado(intentarAbrir(estado.generacion + 1))}
            />
          </>
        )}
      </Pantalla>
    );
  }

  return (
    <ProveedorControlApp control={control}>
      {/* `key`: tras borrar todo o cargar un escenario, la navegación y las vistas arrancan de cero. */}
      <ProveedorNotificaciones notificaciones={notificaciones}>
        <ProveedorSesion key={estado.generacion} ctx={estado.sesion.ctx} nube={nube}>
          <AppProtegida reiniciada={estado.generacion > 0} />
        </ProveedorSesion>
      </ProveedorNotificaciones>
    </ProveedorControlApp>
  );
}

/** Aplica las preferencias de bloqueo guardadas (RF-CFG-03) sobre toda la navegación. */
function AppProtegida({ reiniciada }: { reiniciada: boolean }) {
  const { esquema } = useTema();
  // Tras borrar todo (o cargar un escenario) la navegación vuelve al inicio, que decide onboarding o Hoy.
  useEffect(() => {
    if (reiniciada) router.replace('/');
  }, [reiniciada]);
  const preferencias = useVista(obtenerBloqueo);
  const bloqueo = useBloqueo({ activo: preferencias.activo });
  useOcultarEnMultitarea(preferencias.ocultarEnMultitarea);
  useProcesarCola();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
      {/* Al abrir la app y tras cada cambio (tarjetas, pagos, cortes, preferencias) se reprograman los avisos. */}
      <SincronizarAvisosTarjetas />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="ajustes" />
        <Stack.Screen name="tarjetas/[id]" />
        <Stack.Screen name="tarjetas/nueva" />
      </Stack>
      <CortinaBloqueo bloqueo={bloqueo} />
    </View>
  );
}
