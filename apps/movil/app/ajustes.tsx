import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { compartirArchivo } from '../src/pantallas/ajustes/compartir';
import { ESCENARIOS_DEV } from '../src/pantallas/ajustes/escenarios';
import { SeccionAvisos } from '../src/pantallas/ajustes/SeccionAvisos';
import { SeccionCaptura } from '../src/pantallas/ajustes/SeccionCaptura';
import { exportarCsv, exportarJson, fijarBloqueo, obtenerBloqueo } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useSesion, useVista } from '../src/sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Interruptor, Pantalla, Tarjeta, Texto } from '../src/ui';

const PALABRA_BORRAR = 'BORRAR';
const TOQUES_MENU_DEV = 7;

/**
 * Ajustes (`02 §12`, RF-CFG-03, `04 §6`): bloqueo, ocultar en multitarea, avisos de tarjetas (M4), exportar (JSON y CSV, siempre
 * gratis), borrar todo con confirmación fuerte, aviso de privacidad y versión. En builds de desarrollo, tocar 7
 * veces la versión abre el menú de escenarios semilla.
 */
export default function Ajustes() {
  const router = useRouter();
  const { ctx, refrescar } = useSesion();
  const control = useControlApp();
  const bloqueo = useVista(obtenerBloqueo);
  const version = Constants.expoConfig?.version ?? '—';

  const [exportando, setExportando] = useState<'json' | 'csv' | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [palabra, setPalabra] = useState('');
  const [borrando, setBorrando] = useState(false);
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

  const exportar = async (formato: 'json' | 'csv') => {
    setExportando(formato);
    setMensaje(null);
    try {
      await compartirArchivo(
        formato === 'json'
          ? {
              nombre: 'finanvoz-datos.json',
              contenido: exportarJson(ctx),
              tipoMime: 'application/json',
              titulo: 'Tus datos de Finanvoz',
            }
          : {
              nombre: 'finanvoz-movimientos.csv',
              contenido: exportarCsv(ctx),
              tipoMime: 'text/csv',
              titulo: 'Tus movimientos de Finanvoz',
            },
      );
    } catch {
      setMensaje('No pude preparar el archivo para compartir. Intenta de nuevo.');
    } finally {
      setExportando(null);
    }
  };

  const borrarTodo = async () => {
    setBorrando(true);
    // La raíz cierra la base, destruye la llave y vuelve a empezar en el onboarding.
    await control.borrarTodo();
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

      <Tarjeta>
        <Texto variante="subtitulo">Privacidad</Texto>
        <Texto variante="secundario" tono="secundario">
          Tus datos viven cifrados en este teléfono. Puedes descargarlos cuando quieras, gratis.
        </Texto>
        <Boton
          testID="ajustes-exportar-json"
          variante="secundario"
          etiqueta="Descargar todos mis datos (JSON)"
          cargando={exportando === 'json'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('json')}
        />
        <Boton
          testID="ajustes-exportar-csv"
          variante="secundario"
          etiqueta="Descargar mis movimientos (CSV)"
          cargando={exportando === 'csv'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('csv')}
        />
        <Boton
          testID="ajustes-aviso"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer el aviso de privacidad"
          alPresionar={() => router.push('/aviso-privacidad')}
        />
        {mensaje ? (
          <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
            {mensaje}
          </Texto>
        ) : null}
      </Tarjeta>

      <Tarjeta testID="ajustes-borrar">
        <Texto variante="subtitulo">Borrar todo</Texto>
        {confirmando ? (
          <>
            <Texto variante="cuerpo">
              Se borran de este teléfono todas tus cuentas, tarjetas, movimientos y ajustes. No se puede
              deshacer. Si quieres conservarlos, primero descarga tus datos.
            </Texto>
            <CampoTexto
              testID="ajustes-borrar-palabra"
              etiqueta={`Escribe ${PALABRA_BORRAR} para confirmar`}
              valor={palabra}
              alCambiar={setPalabra}
              nativo={{ autoCapitalize: 'characters', autoCorrect: false }}
            />
            <Boton
              testID="ajustes-borrar-confirmar"
              etiqueta="Borrar todo para siempre"
              deshabilitado={palabra.trim().toUpperCase() !== PALABRA_BORRAR}
              cargando={borrando}
              alPresionar={() => void borrarTodo()}
            />
            <Boton
              variante="texto"
              etiqueta="Cancelar"
              alPresionar={() => {
                setConfirmando(false);
                setPalabra('');
              }}
            />
          </>
        ) : (
          <Boton
            testID="ajustes-borrar-iniciar"
            variante="secundario"
            etiqueta="Borrar todos mis datos"
            alPresionar={() => setConfirmando(true)}
          />
        )}
      </Tarjeta>

      <Pressable
        testID="ajustes-version"
        onPress={tocarVersion}
        accessibilityRole="text"
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
