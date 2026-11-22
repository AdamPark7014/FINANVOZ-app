import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ESCENARIOS_DEV } from '../src/pantallas/ajustes/escenarios';
import {
  BTN_TERMINOS,
  PISTA_AYUDA,
  PISTA_PRIVACIDAD,
  PISTA_RESPALDO,
  PISTA_TERMINOS,
  SECCION_ACERCA,
  SECCION_AYUDA,
  GRUPO_APP,
  GRUPO_AYUDA,
  GRUPO_DINERO,
  GRUPO_SEGURIDAD,
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
import { SeccionApariencia } from '../src/pantallas/ajustes/SeccionApariencia';
import { SeccionColchon } from '../src/pantallas/ajustes/SeccionColchon';
import { SeccionDatosCobro } from '../src/pantallas/ajustes/SeccionDatosCobro';
import { SeccionIngreso } from '../src/pantallas/ajustes/SeccionIngreso';
import { SeccionPlan } from '../src/pantallas/plan';
import { TEXTO_NO_ASESORIA } from '../src/pantallas/privacidad/legales';
import {
  PISTA_ABRIR_SUBPANTALLA,
  TITULO_AVISOS,
  TITULO_SEGURIDAD,
  TITULO_VOZ,
  VALOR_AVISOS,
  VALOR_AVISOS_IOS,
  VALOR_BLOQUEO_ACTIVO,
  VALOR_BLOQUEO_APAGADO,
  VALOR_VOZ_CONTESTA,
  VALOR_VOZ_PANTALLA,
} from '../src/pantallas/ajustes/textos';
import { obtenerBloqueo, obtenerRespaldoNube, obtenerVozRespuesta } from '../src/servicios';
import { useControlApp } from '../src/sesion/ControlApp';
import { useVista } from '../src/sesion/ProveedorSesion';
import { Boton, espacio, FilaAjuste, Pantalla, Tarjeta, Texto } from '../src/ui';
import { Grupo, TituloPantalla } from '../src/ui/componentes/Lista';
import { BarraNativa } from '../src/ui/navegacion';

const TOQUES_MENU_DEV = 7;

/**
 * Ajustes (`02 §12`, RF-CFG-03): bloqueo y ocultar en multitarea (`SeccionBloqueo`), avisos de tarjetas (M4),
 * captura y widget (solo Android, M10), apariencia (`02 §16`), respaldo (M9), privacidad (exportar, borrar todo y el aviso viven en el
 * centro de privacidad, `app/privacidad.tsx`), ayuda (M13, `app/ayuda.tsx`) y versión. En builds de desarrollo,
 * tocar 7 veces la versión abre el menú de escenarios semilla.
 */
export default function Ajustes() {
  return <PantallaAjustes />;
}

/**
 * `enPestana`: montada en Tú (`app/(tabs)/tu.tsx`, el círculo de arriba). Ahí no hay «Volver»: el selector de arriba es
 * la salida.
 */
export function PantallaAjustes({ enPestana = false }: { enPestana?: boolean }) {
  const router = useRouter();
  const control = useControlApp();
  // Sin nube (build sin Supabase), la tarjeta no habla de la nube: invita a exportar el archivo.
  const conNube = Boolean(control.respaldo?.nube);
  const respaldo = useVista((ctx) => obtenerRespaldoNube(ctx, { conNube }));
  const vozActiva = useVista((ctx) => obtenerVozRespuesta(ctx).activa);
  const bloqueoActivo = useVista((ctx) => obtenerBloqueo(ctx).activo);
  const version = Constants.expoConfig?.version ?? '—';

  const [menuDev, setMenuDev] = useState(false);
  const toques = useRef(0);

  const tocarVersion = () => {
    if (!__DEV__ || !control.cargarEscenario) return;
    toques.current += 1;
    if (toques.current >= TOQUES_MENU_DEV) setMenuDev(true);
  };

  return (
    <>
      {enPestana ? null : <BarraNativa salida="/hoy" />}
      <Pantalla
        testID="ajustes"
        // En Tú, la navegación de arriba ya cubre la barra de estado (dirección B) y no hay dock: el área segura de
        // abajo la pone la pantalla.
        bordes={enPestana ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <TituloPantalla
          testID="ajustes-titulo"
          titulo={enPestana ? 'Tú' : TITULO}
          bajada={enPestana ? 'Tu ingreso, la app y tu privacidad.' : null}
        />

        <TituloGrupo titulo={GRUPO_DINERO} />
        <Grupo sangria>
          <SeccionIngreso alCambiar={() => router.push('/ajustes/ingreso')} />
          <SeccionColchon />
          <SeccionDatosCobro />
        </Grupo>

        <TituloGrupo titulo={GRUPO_APP} />
        <Grupo sangria>
          <FilaAjuste
            testID="ajustes-abrir-voz"
            icono="microfono"
            familia="super"
            titulo={TITULO_VOZ}
            valor={vozActiva ? VALOR_VOZ_CONTESTA : VALOR_VOZ_PANTALLA}
            pista={PISTA_ABRIR_SUBPANTALLA}
            alPresionar={() => router.push('/ajustes/voz')}
          />
          <FilaAjuste
            testID="ajustes-abrir-avisos"
            icono="campana"
            familia="antojos"
            titulo={TITULO_AVISOS}
            valor={Platform.OS === 'ios' ? VALOR_AVISOS_IOS : VALOR_AVISOS}
            pista={PISTA_ABRIR_SUBPANTALLA}
            alPresionar={() => router.push('/ajustes/avisos')}
          />
          <SeccionApariencia />
        </Grupo>

        <TituloGrupo titulo={GRUPO_SEGURIDAD} />
        <Grupo sangria>
          <FilaAjuste
            testID="ajustes-abrir-seguridad"
            icono="escudo"
            familia="salidas"
            titulo={TITULO_SEGURIDAD}
            valor={bloqueoActivo ? VALOR_BLOQUEO_ACTIVO : VALOR_BLOQUEO_APAGADO}
            pista={PISTA_ABRIR_SUBPANTALLA}
            alPresionar={() => router.push('/ajustes/seguridad')}
          />
          <View testID="ajustes-respaldo">
            <FilaAjuste
              testID="ajustes-abrir-respaldo"
              icono="nube"
              familia="transporte"
              titulo={SECCION_RESPALDO}
              valor={respaldo.textoUltimo}
              tonoValor={respaldo.pendiente ? 'faltante' : 'secundario'}
              pista={PISTA_RESPALDO}
              alPresionar={() => router.push('/respaldo')}
            />
          </View>
          <FilaAjuste
            testID="ajustes-privacidad"
            icono="candado"
            familia="casa"
            titulo={SECCION_PRIVACIDAD}
            valor={TEXTO_PRIVACIDAD}
            pista={PISTA_PRIVACIDAD}
            alPresionar={() => router.push('/privacidad')}
          />
        </Grupo>

        <TituloGrupo titulo={GRUPO_AYUDA} />
        <SeccionPlan alAbrirPlan={() => router.push('/plan')} />
        <Grupo sangria>
          <FilaAjuste
            testID="ajustes-abrir-ayuda"
            icono="pregunta"
            familia="salidas"
            titulo={SECCION_AYUDA}
            valor={TEXTO_AYUDA}
            pista={PISTA_AYUDA}
            alPresionar={() => router.push('/ayuda')}
          />
          <FilaAjuste
            testID="ajustes-terminos"
            icono="documento"
            familia="otros"
            titulo={BTN_TERMINOS}
            pista={PISTA_TERMINOS}
            alPresionar={() => router.push('/terminos')}
          />
        </Grupo>

        {/* El aviso legal va completo y fuera de la fila: se ve entero y el lector de pantalla lo lee (`08`). */}
        <View testID="ajustes-acerca" style={{ gap: espacio.xs, paddingHorizontal: espacio.xs }}>
          <Texto variante="etiqueta" tono="secundario" accessibilityRole="header">
            {SECCION_ACERCA}
          </Texto>
          <Texto variante="pequeno" tono="secundario" testID="ajustes-no-asesoria">
            {TEXTO_NO_ASESORIA}
          </Texto>
        </View>

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
    </>
  );
}

/** Encabezado de uno de los cuatro grupos de Ajustes (`02 §12`): lo de tu dinero, la app, la seguridad y la ayuda. */
function TituloGrupo({ titulo }: { titulo: string }) {
  return (
    <Texto
      variante="subtitulo"
      accessibilityRole="header"
      style={{ marginTop: espacio.m, marginBottom: -espacio.s, fontWeight: '700', letterSpacing: -0.2 }}
    >
      {titulo}
    </Texto>
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
