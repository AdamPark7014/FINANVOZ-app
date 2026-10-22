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
  ETIQUETA_VOLVER,
  PISTA_AYUDA,
  PISTA_VOLVER,
  SECCION_ACERCA,
  SECCION_AYUDA,
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
import { SeccionBloqueo } from '../src/pantallas/ajustes/SeccionBloqueo';
import { SeccionCaptura } from '../src/pantallas/ajustes/SeccionCaptura';
import { SeccionColchon } from '../src/pantallas/ajustes/SeccionColchon';
import { SeccionDatosCobro } from '../src/pantallas/ajustes/SeccionDatosCobro';
import { SeccionIngreso } from '../src/pantallas/ajustes/SeccionIngreso';
import { SeccionVoz } from '../src/pantallas/ajustes/SeccionVoz';
import { SeccionWidget } from '../src/pantallas/ajustes/SeccionWidget';
import { SeccionPlan } from '../src/pantallas/plan';
import { TEXTO_NO_ASESORIA } from '../src/pantallas/privacidad/legales';
import { obtenerRespaldoNube } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../src/ui';

const TOQUES_MENU_DEV = 7;

/**
 * Ajustes (`02 §12`, RF-CFG-03): bloqueo y ocultar en multitarea (`SeccionBloqueo`), avisos de tarjetas (M4),
 * captura y widget (solo Android, M10), respaldo (M9), privacidad (exportar, borrar todo y el aviso viven en el
 * centro de privacidad, `app/privacidad.tsx`), ayuda (M13, `app/ayuda.tsx`) y versión. En builds de desarrollo,
 * tocar 7 veces la versión abre el menú de escenarios semilla.
 */
export default function Ajustes() {
  const router = useRouter();
  const control = useControlApp();
  // Sin nube (build sin Supabase), la tarjeta no habla de la nube: invita a exportar el archivo.
  const conNube = Boolean(control.respaldo?.nube);
  const respaldo = useVista((ctx) => obtenerRespaldoNube(ctx, { conNube }));
  const version = Constants.expoConfig?.version ?? '—';

  const [menuDev, setMenuDev] = useState(false);
  const toques = useRef(0);
  // Abierto desde un aviso o un enlace no hay a dónde regresar: se va a Hoy.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));

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
        alPresionar={volver}
      />
      <Texto testID="ajustes-titulo" variante="titulo" accessibilityRole="header">
        {TITULO}
      </Texto>

      <SeccionIngreso alCambiar={() => router.push('/ajustes/ingreso')} />
      <SeccionColchon />

      <SeccionBloqueo />

      <SeccionVoz />
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
