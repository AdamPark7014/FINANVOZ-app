import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  etiquetaDiaMes,
  exportarCsv,
  exportarJson,
  fijarEstadisticas,
  obtenerCentroPrivacidad,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { compartirArchivo } from '../ajustes/compartir';
import { TarjetaRespaldo } from '../respaldo/TarjetaRespaldo';
import { RESPONSABLE } from '../onboarding/aviso';

const PALABRA_BORRAR = 'BORRAR';

function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Qué sale del teléfono y a quién (`08 §2`, remisiones a encargados). */
export const SALE_DEL_TELEFONO: readonly { readonly que: string; readonly quien: string }[] = [
  {
    que: 'Las frases que dictas o escribes y la app no entiende sola',
    quien:
      'Van a nuestro servidor (Supabase) y a un proveedor de inteligencia artificial para interpretarlas. Se procesan al momento y no las guardamos.',
  },
  {
    que: 'Un identificador anónimo de la app y cuántas frases interpretaste en el mes',
    quien: 'Nuestro servidor (Supabase), para contar tu cuota.',
  },
  {
    que: 'Reportes de errores, sin montos, comercios, nombres ni lo que dictas',
    quien: 'Sentry.',
  },
  {
    que: 'Estadísticas anónimas de uso, solo si las activas abajo',
    quien: 'PostHog. Nunca llevan montos, comercios, nombres ni lo que dictas.',
  },
  {
    que: 'Tu suscripción, si compras Plus',
    quien: 'Google Play y RevenueCat.',
  },
];

const PERMISOS: readonly { readonly nombre: string; readonly para: string }[] = [
  { nombre: 'Micrófono', para: 'Para registrar hablando. Solo escucha mientras mantienes el botón.' },
  {
    nombre: 'Acceso a notificaciones',
    para: 'Para la captura automática. Solo lee las apps de banco que elijas; las demás se ignoran sin guardarse.',
  },
  { nombre: 'Notificaciones', para: 'Para avisarte de cortes, fechas límite y arqueos.' },
  { nombre: 'Huella o rostro', para: 'Solo si activas el bloqueo de la app.' },
];

/**
 * Centro de privacidad (RF-PRI-03, `02 §12`, `08 §2`): qué se guarda, qué sale del teléfono y a quién,
 * permisos, decisiones (estadísticas, captura), exportar (siempre gratis), respaldo cifrado (M9), borrar todo y
 * el aviso.
 */
export function CentroPrivacidad({
  alVolver,
  alLeerAviso,
  alLeerTerminos,
  alBorrarTodo,
  alRestaurar,
}: {
  alVolver: () => void;
  alLeerAviso: () => void;
  alLeerTerminos: () => void;
  /** La raíz cierra la base, destruye la llave y vuelve al onboarding. */
  alBorrarTodo: () => Promise<void>;
  /** Abre "Restaurar un respaldo" (M9). */
  alRestaurar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const vista = useVista(obtenerCentroPrivacidad);
  const [exportando, setExportando] = useState<'json' | 'csv' | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [palabra, setPalabra] = useState('');
  const [borrando, setBorrando] = useState(false);
  const g = vista.guardado;

  const cambiarEstadisticas = (activo: boolean) => {
    try {
      fijarEstadisticas(ctx, activo);
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

  return (
    <>
      <Boton
        testID="privacidad-volver"
        variante="texto"
        ancho="contenido"
        etiqueta="Volver"
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Tu privacidad</Texto>
      <Texto variante="cuerpo" tono="secundario">
        Tus datos viven cifrados en este teléfono. Aquí ves qué se guarda, qué sale y a quién, y decides.
      </Texto>

      <Tarjeta testID="privacidad-guardado">
        <Texto variante="subtitulo">Qué se guarda en este teléfono</Texto>
        {[
          cuenta(g.cuentas, 'cuenta', 'cuentas'),
          cuenta(g.tarjetas, 'tarjeta', 'tarjetas'),
          cuenta(g.movimientos, 'movimiento', 'movimientos'),
          cuenta(
            g.personas,
            'persona a quien prestas o que te debe',
            'personas a quienes prestas o que te deben',
          ),
          `${cuenta(g.textosNotificacion, 'aviso de banco', 'avisos de banco')} (se borran a los 30 días)`,
          cuenta(g.frasesPorInterpretar, 'frase esperando internet', 'frases esperando internet'),
        ].map((linea) => (
          <Texto key={linea} variante="cuerpo">{`• ${linea}`}</Texto>
        ))}
        <Texto variante="secundario" tono="secundario">
          Todo se guarda cifrado con una llave que solo existe en este teléfono. No se copia en los respaldos
          del sistema.
        </Texto>
      </Tarjeta>

      <Tarjeta testID="privacidad-sale">
        <Texto variante="subtitulo">Qué sale de tu teléfono y a quién</Texto>
        {SALE_DEL_TELEFONO.map((s) => (
          <View key={s.que} style={{ gap: espacio.xxs }}>
            <Texto variante="cuerpo">{s.que}</Texto>
            <Texto variante="secundario" tono="secundario">
              {s.quien}
            </Texto>
          </View>
        ))}
        <Texto variante="secundario" tono="secundario">
          Algunos de estos servicios procesan datos fuera de México.
        </Texto>
        <Texto variante="cuerpo">
          Nunca salen: tus movimientos, saldos, cuentas ni el texto de los avisos de tu banco.
        </Texto>
      </Tarjeta>

      <Tarjeta testID="privacidad-decisiones">
        <Texto variante="subtitulo">Tus decisiones</Texto>
        <Interruptor
          testID="privacidad-estadisticas"
          etiqueta="Compartir estadísticas anónimas de uso"
          descripcion="Ayudan a mejorar la app. Sin montos, comercios, nombres ni lo que dictas. Si lo apagas no pierdes nada."
          valor={vista.estadisticas}
          alCambiar={cambiarEstadisticas}
        />
        <Texto variante="cuerpo" testID="privacidad-captura">
          {vista.captura.activada
            ? `Captura automática: activa con ${cuenta(vista.captura.apps, 'app de banco', 'apps de banco')}. La apagas en Ajustes.`
            : 'Captura automática: apagada. La activas en Ajustes.'}
        </Texto>
        {vista.consentimiento ? (
          <Texto variante="secundario" tono="secundario" testID="privacidad-consentimiento">
            {`Aceptaste el aviso de privacidad (versión ${vista.consentimiento.version}) el ${etiquetaDiaMes(vista.consentimiento.fecha)} ${vista.consentimiento.fecha.slice(0, 4)}.`}
          </Texto>
        ) : null}
      </Tarjeta>

      <Tarjeta testID="privacidad-permisos">
        <Texto variante="subtitulo">Permisos del teléfono</Texto>
        {PERMISOS.map((p) => (
          <View key={p.nombre} style={{ gap: espacio.xxs }}>
            <Texto variante="cuerpo">{p.nombre}</Texto>
            <Texto variante="secundario" tono="secundario">
              {p.para}
            </Texto>
          </View>
        ))}
        <Boton
          testID="privacidad-ajustes-telefono"
          variante="secundario"
          etiqueta="Revisar permisos en tu teléfono"
          pista="Abre los ajustes de Finanvoz en Android"
          alPresionar={() => void Linking.openSettings().catch(() => {})}
        />
      </Tarjeta>

      <Tarjeta testID="privacidad-datos">
        <Texto variante="subtitulo">Tus datos</Texto>
        <Texto variante="secundario" tono="secundario">
          Descárgalos cuando quieras, gratis, también si cancelas Plus.
        </Texto>
        <Boton
          testID="privacidad-exportar-json"
          variante="secundario"
          etiqueta="Descargar todos mis datos (JSON)"
          cargando={exportando === 'json'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('json')}
        />
        <Boton
          testID="privacidad-exportar-csv"
          variante="secundario"
          etiqueta="Descargar mis movimientos (CSV)"
          cargando={exportando === 'csv'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('csv')}
        />
        <Boton
          testID="privacidad-aviso"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer el aviso de privacidad"
          alPresionar={alLeerAviso}
        />
        <Boton
          testID="privacidad-terminos"
          variante="texto"
          ancho="contenido"
          etiqueta="Leer los términos de uso"
          alPresionar={alLeerTerminos}
        />
        <Texto variante="secundario" tono="secundario">
          {`Para ejercer tus derechos o revocar tu consentimiento también puedes escribir a ${RESPONSABLE.correo}.`}
        </Texto>
        {mensaje ? (
          <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
            {mensaje}
          </Texto>
        ) : null}
      </Tarjeta>

      <TarjetaRespaldo alRestaurar={alRestaurar} />

      <Tarjeta testID="privacidad-borrar">
        <Texto variante="subtitulo">Borrar todo</Texto>
        {confirmando ? (
          <>
            <Texto variante="cuerpo">
              Se borran de este teléfono todas tus cuentas, tarjetas, movimientos y ajustes. No se puede
              deshacer. Si quieres conservarlos, primero descarga tus datos.
            </Texto>
            <CampoTexto
              testID="privacidad-borrar-palabra"
              etiqueta={`Escribe ${PALABRA_BORRAR} para confirmar`}
              valor={palabra}
              alCambiar={setPalabra}
              nativo={{ autoCapitalize: 'characters', autoCorrect: false }}
            />
            <Boton
              testID="privacidad-borrar-confirmar"
              etiqueta="Borrar todo para siempre"
              deshabilitado={palabra.trim().toUpperCase() !== PALABRA_BORRAR}
              cargando={borrando}
              alPresionar={() => {
                setBorrando(true);
                void alBorrarTodo();
              }}
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
            testID="privacidad-borrar-iniciar"
            variante="secundario"
            etiqueta="Borrar todos mis datos"
            alPresionar={() => setConfirmando(true)}
          />
        )}
      </Tarjeta>
    </>
  );
}
