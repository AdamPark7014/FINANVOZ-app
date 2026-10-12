import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ESCENARIOS_DEV } from '../src/pantallas/ajustes/escenarios';
import { SeccionAvisos } from '../src/pantallas/ajustes/SeccionAvisos';
import { SeccionCaptura } from '../src/pantallas/ajustes/SeccionCaptura';
import { SeccionDatosCobro } from '../src/pantallas/ajustes/SeccionDatosCobro';
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
      setMensaje('No pude guardar el cambio. Intenta de nuevo.');
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
        etiqueta="Volver"
        alPresionar={() => router.back()}
      />
      <Texto variante="titulo">Ajustes</Texto>

      <Tarjeta>
        <Texto variante="subtitulo">Bloqueo</Texto>
        <Interruptor
          testID="ajustes-bloqueo"
          etiqueta="Pedir huella o PIN al abrir"
          descripcion="También al volver después de 1 minuto fuera de la app."
          valor={bloqueo.activo}
          alCambiar={(activo) => cambiarBloqueo({ activo })}
        />
        <Interruptor
          testID="ajustes-multitarea"
          etiqueta="Ocultar en multitarea"
          descripcion="La vista previa de apps recientes sale en blanco y no se permiten capturas de pantalla."
          valor={bloqueo.ocultarEnMultitarea}
          alCambiar={(ocultarEnMultitarea) => cambiarBloqueo({ ocultarEnMultitarea })}
        />
      </Tarjeta>

      <SeccionAvisos />
      <SeccionCaptura />
      <SeccionWidget />

      <Tarjeta testID="ajustes-respaldo">
        <Texto variante="subtitulo">Respaldo</Texto>
        <Texto variante="secundario" tono={respaldo.pendiente ? 'faltante' : 'secundario'}>
          {respaldo.textoUltimo}
        </Texto>
        <Boton
          testID="ajustes-abrir-respaldo"
          variante="secundario"
          etiqueta="Respaldar y restaurar"
          alPresionar={() => router.push('/respaldo')}
        />
      </Tarjeta>

      <SeccionDatosCobro />
      <SeccionPlan alAbrirPlan={() => router.push('/plan')} />

      <Tarjeta>
        <Texto variante="subtitulo">Privacidad</Texto>
        <Texto variante="secundario" tono="secundario">
          Qué se guarda, qué sale de tu teléfono y a quién, tus permisos, descargar o borrar tus datos.
        </Texto>
        <Boton
          testID="ajustes-privacidad"
          variante="secundario"
          etiqueta="Abrir el centro de privacidad"
          alPresionar={() => router.push('/privacidad')}
        />
        {mensaje ? (
          <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
            {mensaje}
          </Texto>
        ) : null}
      </Tarjeta>

      <Tarjeta testID="ajustes-ayuda">
        <Texto variante="subtitulo">Ayuda</Texto>
        <Texto variante="secundario" tono="secundario">
          Respuestas a las dudas más comunes y nuestro correo de contacto.
        </Texto>
        <Boton
          testID="ajustes-abrir-ayuda"
          variante="secundario"
          etiqueta="Ver preguntas frecuentes"
          alPresionar={() => router.push('/ayuda')}
        />
      </Tarjeta>

      <Tarjeta testID="ajustes-acerca">
        <Texto variante="subtitulo">Acerca de</Texto>
        <Texto variante="secundario" tono="secundario">
          {TEXTO_NO_ASESORIA}
        </Texto>
        <Boton
          testID="ajustes-terminos"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer los términos de uso"
          alPresionar={() => router.push('/terminos')}
        />
      </Tarjeta>

      <Pressable
        testID="ajustes-version"
        onPress={tocarVersion}
        accessibilityRole="text"
        accessibilityLabel={`Finanvoz versión ${version}`}
        style={{ paddingVertical: espacio.s }}
      >
        <Texto variante="secundario" tono="secundario" alinear="center">
          {`Finanvoz ${version}`}
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
      <Texto variante="subtitulo">Desarrollo · escenarios</Texto>
      <Texto variante="secundario" tono="secundario">
        Borra todo y carga el escenario. El reloj queda fijo en su fecha hasta cerrar la app.
      </Texto>
      <View style={{ gap: espacio.s }}>
        {ESCENARIOS_DEV.map((e) => (
          <Boton
            key={e.id}
            testID={`ajustes-dev-${e.id}`}
            variante="secundario"
            etiqueta={`Cargar ${e.id}`}
            alPresionar={() => {
              cargar(e.cargar()).catch(() => setError(`No pude cargar ${e.id}.`));
            }}
          />
        ))}
      </View>
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
