import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ESCENARIOS_DEV } from '../src/pantallas/ajustes/escenarios';
import {
  BTN_AYUDA,
  BTN_PRIVACIDAD,
  BTN_RESPALDAR_RESTAURAR,
  BTN_TERMINOS,
  DESC_BLOQUEO,
  DESC_MULTITAREA,
  ETIQUETA_BLOQUEO,
  ETIQUETA_MULTITAREA,
  ETIQUETA_VOLVER,
  MENSAJE_NO_GUARDAR,
  PISTA_AYUDA,
  PISTA_VOLVER,
  SECCION_ACERCA,
  SECCION_AYUDA,
  SECCION_BLOQUEO,
  SECCION_DEV,
  SECCION_PRIVACIDAD,
  SECCION_RESPALDO,
  TEXTO_AYUDA,
  TEXTO_DEV,
  TEXTO_PRIVACIDAD,
  TITULO,
  etiquetaAccesibilidadVersion,
  etiquetaCargarEscenario,
  lineaVersion,
  mensajeErrorCargarEscenario,
} from '../src/pantallas/ajustes';
import { SeccionAvisos } from '../src/pantallas/ajustes/SeccionAvisos';
import { SeccionCaptura } from '../src/pantallas/ajustes/SeccionCaptura';
import { SeccionColchon } from '../src/pantallas/ajustes/SeccionColchon';
import { SeccionDatosCobro } from '../src/pantallas/ajustes/SeccionDatosCobro';
import { SeccionIngreso } from '../src/pantallas/ajustes/SeccionIngreso';
import { SeccionWidget } from '../src/pantallas/ajustes/SeccionWidget';
import { SeccionPlan } from '../src/pantallas/plan';
import { TEXTO_NO_ASESORIA } from '../src/pantallas/privacidad/legales';
import { fijarBloqueo, obtenerBloqueo, obtenerRespaldoNube } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useSesion, useVista } from '../src/sesion/ProveedorSesion';
import { Boton, espacio, Interruptor, Pantalla, Tarjeta, Texto } from '../src/ui';

const TOQUES_MENU_DEV = 7;

/**
 * Ajustes (`02 §12`, RF-CFG-03): bloqueo, ocultar en multitarea, avisos de tarjetas (M4), captura, widget (M10), respaldo (M9), privacidad
 * (exportar, borrar todo y el aviso viven en el centro de privacidad, `app/privacidad.tsx`), ayuda (M13,
 * `app/ayuda.tsx`) y versión. En builds
 * de desarrollo, tocar 7 veces la versión abre el menú de escenarios semilla.
 */
export default function Ajustes() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const control = useControlApp();
  const bloqueo = useVista(obtenerBloqueo);
  const respaldo = useVista(obtenerRespaldoNube);
  const version = Constants.expoConfig?.version ?? '—';

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [menuDev, setMenuDev] = useState(false);
  const toques = useRef(0);

  const cambiarBloqueo = (cambios: Parameters<typeof fijarBloqueo>[1]) => {
    try {
      fijarBloqueo(ctx, cambios);
      refrescar();
    } catch {
      setMensaje(MENSAJE_NO_GUARDAR);
    }
  };

  const tocarVersion = () => {
    if (!__DEV__ || !control.cargarEscenario) return;
    toques.current += 1;
    if (toques.current >= TOQUES_MENU_DEV) setMenuDev(true);
  };

  return (
    <Pantalla testID="ajustes" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="ajustes-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={() => router.back()}
      />
      <Texto testID="ajustes-titulo" variante="titulo" accessibilityRole="header">
        {TITULO}
      </Texto>

      <SeccionIngreso alCambiar={() => router.push('/ajustes/ingreso')} />
      <SeccionColchon />

      <Tarjeta testID="ajustes-seccion-bloqueo">
        <Texto variante="subtitulo">{SECCION_BLOQUEO}</Texto>
        <Interruptor
          testID="ajustes-bloqueo"
          etiqueta={ETIQUETA_BLOQUEO}
          descripcion={DESC_BLOQUEO}
          valor={bloqueo.activo}
          alCambiar={(activo) => cambiarBloqueo({ activo })}
        />
        <Interruptor
          testID="ajustes-multitarea"
          etiqueta={ETIQUETA_MULTITAREA}
          descripcion={DESC_MULTITAREA}
          valor={bloqueo.ocultarEnMultitarea}
          alCambiar={(ocultarEnMultitarea) => cambiarBloqueo({ ocultarEnMultitarea })}
        />
      </Tarjeta>

      <SeccionAvisos />
      <SeccionCaptura />
      <SeccionWidget />

      <Tarjeta testID="ajustes-respaldo">
        <Texto variante="subtitulo">{SECCION_RESPALDO}</Texto>
        <Texto variante="secundario" tono={respaldo.pendiente ? 'faltante' : 'secundario'}>
          {respaldo.textoUltimo}
        </Texto>
        <Boton
          testID="ajustes-abrir-respaldo"
          variante="secundario"
          etiqueta={BTN_RESPALDAR_RESTAURAR}
          alPresionar={() => router.push('/respaldo')}
        />
      </Tarjeta>

      <SeccionDatosCobro />
      <SeccionPlan alAbrirPlan={() => router.push('/plan')} />

      <Tarjeta>
        <Texto variante="subtitulo">{SECCION_PRIVACIDAD}</Texto>
        <Texto variante="secundario" tono="secundario">
          {TEXTO_PRIVACIDAD}
        </Texto>
        <Boton
          testID="ajustes-privacidad"
          variante="secundario"
          etiqueta={BTN_PRIVACIDAD}
          alPresionar={() => router.push('/privacidad')}
        />
        {mensaje ? (
          <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
            {mensaje}
          </Texto>
        ) : null}
      </Tarjeta>

      <Tarjeta testID="ajustes-ayuda">
        <Texto variante="subtitulo">{SECCION_AYUDA}</Texto>
        <Texto variante="secundario" tono="secundario">
          {TEXTO_AYUDA}
        </Texto>
        <Boton
          testID="ajustes-abrir-ayuda"
          variante="secundario"
          etiqueta={BTN_AYUDA}
          pista={PISTA_AYUDA}
          alPresionar={() => router.push('/ayuda')}
        />
      </Tarjeta>

      <Tarjeta testID="ajustes-acerca">
        <Texto variante="subtitulo">{SECCION_ACERCA}</Texto>
        <Texto variante="secundario" tono="secundario">
          {TEXTO_NO_ASESORIA}
        </Texto>
        <Boton
          testID="ajustes-terminos"
          variante="texto"
          ancho="contenido"
          etiqueta={BTN_TERMINOS}
          alPresionar={() => router.push('/terminos')}
        />
      </Tarjeta>

      <Pressable
        testID="ajustes-version"
        onPress={tocarVersion}
        accessibilityRole="text"
        accessibilityLabel={etiquetaAccesibilidadVersion(version)}
        style={{ paddingVertical: espacio.s }}
      >
        <Texto
          variante="secundario"
          tono="secundario"
          alinear="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {lineaVersion(version)}
        </Texto>
      </Pressable>

      {__DEV__ && menuDev && control.cargarEscenario ? (
        <MenuDesarrollo cargar={control.cargarEscenario} />
      ) : null}
    </Pantalla>
  );
}

/** Solo `__DEV__`: borra la base y carga un escenario de `fixtures/escenarios` con el reloj en su `hoy`. */
function MenuDesarrollo({ cargar }: { cargar: (datos: unknown) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Tarjeta testID="ajustes-dev">
      <Texto variante="subtitulo">{SECCION_DEV}</Texto>
      <Texto variante="secundario" tono="secundario">
        {TEXTO_DEV}
      </Texto>
      <View style={{ gap: espacio.s }}>
        {ESCENARIOS_DEV.map((e) => (
          <Boton
            key={e.id}
            testID={`ajustes-dev-${e.id}`}
            variante="secundario"
            etiqueta={etiquetaCargarEscenario(e.id)}
            alPresionar={() => {
              cargar(e.cargar()).catch(() => setError(mensajeErrorCargarEscenario(e.id)));
            }}
          />
        ))}
      </View>
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
