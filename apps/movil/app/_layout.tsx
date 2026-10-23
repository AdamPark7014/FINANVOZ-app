import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { crearAnaliticaExpo } from '../src/analitica/expo';
import { ProveedorCaptura } from '../src/captura/ProveedorCaptura';
import { SincronizarCaptura } from '../src/captura/SincronizarCaptura';
import { puenteCaptura } from '../src/captura/puente';
import { sha256Expo } from '../src/captura/sha256Expo';
import { dependenciasCompartidoExpo } from '../src/compartido/expo';
import { programarSincronizacionCompartido } from '../src/compartido/programar';
import { SincronizarCompartido } from '../src/compartido/SincronizarCompartido';
import { conectividadExpo } from '../src/nube/conectividad';
import { crearNivelNubeExpo, crearNubeRespaldoExpo, crearPuertoEvidenciaExpo } from '../src/nube/expo';
import { useEvidenciaConsentimiento } from '../src/nube/useEvidenciaConsentimiento';
import { useProcesarCola } from '../src/nube/useProcesarCola';
import { iniciarSentry } from '../src/observabilidad';
import { crearNotificacionesExpo } from '../src/pantallas/avisos/expo';
import { ProveedorNotificaciones, SincronizarAvisosTarjetas } from '../src/pantallas/avisos/notificaciones';
import { archivosRespaldoExpo, dependenciasRespaldoExpo } from '../src/respaldo/expo';
import { programarRespaldoAutomatico } from '../src/respaldo/programar';
import { SincronizarRespaldoAutomatico } from '../src/pantallas/respaldo/SincronizarRespaldoAutomatico';
import { SincronizarWidget } from '../src/widget/SincronizarWidget';
import { programarTareaDiaria } from '../src/tareas/programar';
import { CortinaBloqueo, useBloqueo, useOcultarEnMultitarea } from '../src/seguridad';
import { crearComprasExpo } from '../src/suscripciones/expo';
import { ProveedorPlan } from '../src/suscripciones/ProveedorPlan';
import {
  cargarEscenario,
  leerMontoDictado,
  mensajeRestaurado,
  obtenerBloqueo,
  relojFijo,
  type PuertoEvidencia,
} from '../src/servicios';
import { abrirSesion, borrarTodoApp, restaurarSesion, type Sesion } from '../src/servicios/sesion';
import { ProveedorAnalitica, useAnalitica } from '../src/sesion/ProveedorAnalitica';
import { ProveedorControlApp, type ControlApp } from '../src/sesion/ControlApp';
import { ProveedorSesion, useVista } from '../src/sesion/ProveedorSesion';
import { Aviso, Boton, etiquetaHablada, Pantalla, Texto, useAnunciar, useTema } from '../src/ui';
import { motorExpo, ProveedorDictado } from '../src/voz';

iniciarSentry();

type Estado =
  | { tipo: 'lista'; sesion: Sesion; generacion: number; aviso?: string }
  | { tipo: 'trabajando'; generacion: number }
  | { tipo: 'error'; generacion: number };

/** Abre la base cifrada; si falla, la raíz muestra una pantalla amable con "Intentar de nuevo". */
function intentarAbrir(generacion: number, preparar?: () => Sesion, aviso?: string): Estado {
  try {
    const sesion = preparar ? preparar() : abrirSesion();
    return { tipo: 'lista', sesion, generacion, ...(aviso ? { aviso } : {}) };
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
  // Compras de Plus con RevenueCat (M7); `null` sin llave en producción (la cuenta queda en Gratis).
  const compras = useMemo(() => crearComprasExpo(), []);
  // PostHog solo si la build trae llave; aun así nada sale sin el opt-in de estadísticas (`03 §8`).
  const analitica = useMemo(() => crearAnaliticaExpo(), []);
  // Copia mínima de la evidencia del consentimiento en Supabase (`08 §2`).
  const evidencia = useMemo(() => crearPuertoEvidenciaExpo(), []);
  // Cuenta de respaldo y bucket de Supabase (M9); `null` sin configuración: solo respaldo en archivo.
  const nubeRespaldo = useMemo(() => crearNubeRespaldoExpo(), []);

  const reemplazarSesion = useCallback(
    async (preparar?: () => Sesion, aviso?: string, conservarSesionNube = false) => {
      const siguiente = estado.generacion + 1;
      setEstado({ tipo: 'trabajando', generacion: siguiente });
      try {
        await borrarTodoApp(sesion, { conservarSesionNube });
      } catch {
        setEstado({ tipo: 'error', generacion: siguiente });
        return;
      }
      setEstado(intentarAbrir(siguiente, preparar, aviso));
    },
    [estado.generacion, sesion],
  );

  const control = useMemo<ControlApp>(
    () => ({
      borrarTodo: () => reemplazarSesion(),
      respaldo: {
        deps: dependenciasRespaldoExpo,
        archivos: archivosRespaldoExpo,
        // El respaldo ya se descifró y se ensayó en memoria: aquí solo se reemplaza la base. La sesión de la nube
        // (la de correo con la que se bajó el respaldo) se conserva: es identidad, no datos.
        restaurar: (listo) => reemplazarSesion(() => restaurarSesion(listo), mensajeRestaurado(listo), true),
        nube: nubeRespaldo,
        programarAutomatico: programarRespaldoAutomatico,
      },
      ...(__DEV__
        ? {
            cargarEscenario: (datos: unknown) =>
              reemplazarSesion(() => {
                // El reloj se fija en el `hoy` del escenario hasta el próximo arranque en frío.
                const esc = datos as { hoy: string; catalogo_suscripciones?: readonly string[] };
                const nueva = abrirSesion(relojFijo(esc.hoy, Date.now()));
                if (esc.catalogo_suscripciones !== undefined) {
                  Object.assign(nueva.ctx, { catalogoSuscripciones: esc.catalogo_suscripciones });
                }
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
    [reemplazarSesion, nubeRespaldo],
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
      {/*
        Un solo reconocedor para toda la app: un micrófono a la vez, y el micrófono de cada campo de dinero y de
        «O dímelo» con la cifra leída por el nivel 0 (`ui/` no conoce el reconocedor: se lo inyecta `voz/`).
      */}
      <ProveedorDictado motor={motorExpo} leerMonto={leerMontoDictado}>
        {/* `key`: tras borrar todo o cargar un escenario, la navegación y las vistas arrancan de cero. */}
        <ProveedorNotificaciones notificaciones={notificaciones}>
          <ProveedorSesion key={estado.generacion} ctx={estado.sesion.ctx} nube={nube}>
            {/* Sin tienda no hay nada que comprar: sin `abrirPlan`, Hoy y los candados no ofrecen Plus. */}
            <ProveedorPlan compras={compras} abrirPlan={compras ? abrirPlan : null}>
              <ProveedorAnalitica analitica={analitica}>
                <AppProtegida
                  reiniciada={estado.generacion > 0}
                  evidencia={evidencia}
                  avisoInicial={estado.aviso ?? null}
                />
              </ProveedorAnalitica>
            </ProveedorPlan>
          </ProveedorSesion>
        </ProveedorNotificaciones>
      </ProveedorDictado>
    </ProveedorControlApp>
  );
}

/** Pantalla del plan, desde cualquier candado "· Plus". */
const abrirPlan = () => router.push('/plan');

/** Aplica las preferencias de bloqueo guardadas (RF-CFG-03) sobre toda la navegación. */
function AppProtegida({
  reiniciada,
  evidencia,
  avisoInicial,
}: {
  reiniciada: boolean;
  evidencia: PuertoEvidencia | null;
  /** "Listo: recuperé 1,284 movimientos" tras restaurar un respaldo (`02 §19`). */
  avisoInicial: string | null;
}) {
  const { esquema } = useTema();
  const [aviso, setAviso] = useState(avisoInicial);
  // "Listo: recuperé …": TalkBack lo lee por la región viva del aviso; VoiceOver necesita el anuncio.
  useAnunciar(aviso ? etiquetaHablada(aviso) : null);
  // Tras borrar todo (o cargar un escenario) la navegación vuelve al inicio, que decide onboarding o Hoy.
  useEffect(() => {
    if (reiniciada) router.replace('/');
  }, [reiniciada]);
  const registrarEvento = useAnalitica();
  useEffect(() => {
    registrarEvento({ nombre: 'app_abierta', propiedades: {} });
  }, [registrarEvento]);
  const preferencias = useVista(obtenerBloqueo);
  const bloqueo = useBloqueo({ activo: preferencias.activo });
  useOcultarEnMultitarea(preferencias.ocultarEnMultitarea);
  useProcesarCola();
  useEvidenciaConsentimiento(evidencia);
  // Apertura del día en segundo plano (suscripciones, ocurrencias, cortes y widget); registrarla es idempotente.
  useEffect(() => {
    void programarTareaDiaria(true);
  }, []);
  return (
    // Captura automática (`07`): sin el módulo nativo (Expo Go, iPhone) el puente no está disponible y nada cambia.
    <ProveedorCaptura puente={puenteCaptura} sha256={sha256Expo}>
      <View style={{ flex: 1 }}>
        <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
        {/* Al abrir la app y tras cada cambio (tarjetas, pagos, cortes, preferencias) se reprograman los avisos. */}
        <SincronizarAvisosTarjetas />
        {/* La tarea semanal queda registrada solo mientras el respaldo automático está encendido. */}
        <SincronizarRespaldoAutomatico />
        {/* El widget "Hoy puedes" se vuelve a pintar tras cada escritura (≤ 5 s con la app abierta, `02 §21`). */}
        <SincronizarWidget />
        {/* Gastos compartidos: tarea en segundo plano mientras haya un grupo abierto y sincronizar al volver la red. */}
        <SincronizarCompartido
          deps={dependenciasCompartidoExpo()}
          conectividad={conectividadExpo}
          programar={programarSincronizacionCompartido}
        />
        {/* Cola de captura en segundo plano mientras la lectura de avisos bancarios está activa. */}
        <SincronizarCaptura />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="ajustes" />
          <Stack.Screen name="tarjetas/[id]" />
          <Stack.Screen name="tarjetas/nueva" />
          <Stack.Screen name="cuenta-nueva" />
          <Stack.Screen name="pago-fijo-nuevo" />
          <Stack.Screen name="persona/[id]" />
          <Stack.Screen name="tandas/index" />
          <Stack.Screen name="tandas/[id]" />
          <Stack.Screen name="compartido/index" />
          <Stack.Screen name="compartido/[id]" />
          <Stack.Screen name="suscripciones" />
          <Stack.Screen name="deducciones" />
          <Stack.Screen name="expo-sharing" />
          <Stack.Screen name="estado-cuenta" />
          <Stack.Screen name="arqueo" />
          <Stack.Screen name="me-alcanza" />
          <Stack.Screen name="plan" />
          <Stack.Screen name="privacidad" />
          <Stack.Screen name="respaldo" />
          <Stack.Screen name="restaurar" />
          <Stack.Screen name="terminos" />
        </Stack>
        <Aviso aviso={aviso ? { id: 'restaurado', mensaje: aviso } : null} alCerrar={() => setAviso(null)} />
        <CortinaBloqueo bloqueo={bloqueo} />
      </View>
    </ProveedorCaptura>
  );
}
