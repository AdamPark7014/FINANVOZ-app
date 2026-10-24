import { useState } from 'react';
import { Linking, View } from 'react-native';
import { exportarCsv, exportarJson, fijarEstadisticas, obtenerCentroPrivacidad } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Interruptor, Tarjeta, Texto } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import { compartirArchivo } from '../ajustes/compartir';
import { TarjetaRespaldo } from '../respaldo/TarjetaRespaldo';
import {
  BTN_BORRAR_CONFIRMAR,
  BTN_BORRAR_INICIAR,
  BTN_CANCELAR,
  BTN_EXPORTAR_CSV,
  BTN_EXPORTAR_JSON,
  BTN_LEER_AVISO,
  BTN_LEER_TERMINOS,
  BTN_PERMISOS_TELEFONO,
  DESC_ESTADISTICAS,
  ETIQUETA_ESTADISTICAS,
  ACCESIBILIDAD_VOLVER,
  ETIQUETA_VOLVER,
  etiquetaAccesibleCaptura,
  etiquetaAccesibleConsentimiento,
  etiquetaAccesibleDerechosArco,
  etiquetaAccesibleIntroPrivacidad,
  etiquetaConfirmarBorrar,
  etiquetaLineaGuardado,
  guardadoVacio,
  INTRO_PRIVACIDAD,
  lineasGuardado,
  MENSAJE_NO_EXPORTAR,
  MENSAJE_NO_GUARDAR,
  NOTA_CIFRADO_GUARDADO,
  NOTA_SERVICIOS_FUERA_MX,
  PALABRA_BORRAR,
  permisosTelefono,
  PISTA_BORRAR_CANCELAR,
  PISTA_BORRAR_CONFIRMAR,
  PISTA_BORRAR_INICIAR,
  PISTA_EXPORTAR_CSV,
  PISTA_EXPORTAR_JSON,
  PISTA_LEER_AVISO,
  PISTA_LEER_TERMINOS,
  pistaPermisosTelefono,
  PISTA_VOLVER,
  saleDelTelefono,
  SECCION_BORRAR,
  SECCION_DATOS,
  SECCION_DECISIONES,
  SECCION_GUARDADO,
  SECCION_PERMISOS,
  SECCION_SALE,
  TEXTO_BORRAR_ADVERTENCIA,
  TEXTO_DESCARGA_GRATIS,
  TEXTO_GUARDADO_VACIO,
  TEXTO_NUNCA_SALEN,
  TEXTO_SIN_CONSENTIMIENTO,
  TITULO_COMPARTIR_CSV,
  TITULO_COMPARTIR_JSON,
  TITULO_PRIVACIDAD,
  textoCaptura,
  textoConsentimiento,
  textoDerechosArco,
} from './textos';

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
  const [mensaje, setMensajeBase] = useState<string | null>(null);
  // VoiceOver no lee la región viva del mensaje: en iPhone se anuncia aparte.
  const setMensaje = (texto: string | null) => {
    setMensajeBase(texto);
    if (texto) anunciar(texto);
  };
  const [confirmando, setConfirmando] = useState(false);
  const [palabra, setPalabra] = useState('');
  const [borrando, setBorrando] = useState(false);
  const g = vista.guardado;

  const cambiarEstadisticas = (activo: boolean) => {
    try {
      fijarEstadisticas(ctx, activo);
      refrescar();
    } catch {
      setMensaje(MENSAJE_NO_GUARDAR);
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
              titulo: TITULO_COMPARTIR_JSON,
            }
          : {
              nombre: 'finanvoz-movimientos.csv',
              contenido: exportarCsv(ctx),
              tipoMime: 'text/csv',
              titulo: TITULO_COMPARTIR_CSV,
            },
      );
    } catch {
      setMensaje(MENSAJE_NO_EXPORTAR);
    } finally {
      setExportando(null);
    }
  };

  return (
    <View style={{ gap: espacio.xl }}>
      <Boton
        testID="privacidad-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        etiquetaAccesible={ACCESIBILIDAD_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={alVolver}
      />
      <Texto testID="privacidad-titulo" variante="titulo" accessibilityRole="header">
        {TITULO_PRIVACIDAD}
      </Texto>
      <Texto
        testID="privacidad-intro"
        variante="cuerpo"
        tono="secundario"
        accessibilityRole="text"
        accessibilityLabel={etiquetaAccesibleIntroPrivacidad()}
      >
        {INTRO_PRIVACIDAD}
      </Texto>

      <Tarjeta testID="privacidad-guardado">
        <Texto testID="privacidad-guardado-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_GUARDADO}
        </Texto>
        {guardadoVacio(g) ? (
          <Texto testID="privacidad-guardado-vacio" variante="cuerpo" tono="secundario">
            {TEXTO_GUARDADO_VACIO}
          </Texto>
        ) : (
          lineasGuardado(g).map((linea) => (
            <Texto key={linea} variante="cuerpo" accessibilityLabel={etiquetaLineaGuardado(linea)}>
              {`• ${linea}`}
            </Texto>
          ))
        )}
        <Texto variante="secundario" tono="secundario">
          {NOTA_CIFRADO_GUARDADO}
        </Texto>
      </Tarjeta>

      <Tarjeta testID="privacidad-sale">
        <Texto testID="privacidad-sale-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_SALE}
        </Texto>
        {saleDelTelefono().map((s) => (
          <View key={s.que} style={{ gap: espacio.xs }}>
            <Texto variante="cuerpo">{s.que}</Texto>
            <Texto variante="secundario" tono="secundario">
              {s.quien}
            </Texto>
          </View>
        ))}
        <Texto variante="secundario" tono="secundario">
          {NOTA_SERVICIOS_FUERA_MX}
        </Texto>
        <Texto variante="cuerpo">{TEXTO_NUNCA_SALEN}</Texto>
      </Tarjeta>

      <Tarjeta testID="privacidad-decisiones">
        <Texto testID="privacidad-decisiones-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_DECISIONES}
        </Texto>
        <Interruptor
          testID="privacidad-estadisticas"
          etiqueta={ETIQUETA_ESTADISTICAS}
          descripcion={DESC_ESTADISTICAS}
          valor={vista.estadisticas}
          alCambiar={cambiarEstadisticas}
        />
        <Texto
          variante="cuerpo"
          testID="privacidad-captura"
          accessibilityLabel={etiquetaAccesibleCaptura(vista.captura.activada, vista.captura.apps)}
        >
          {textoCaptura(vista.captura.activada, vista.captura.apps)}
        </Texto>
        {vista.consentimiento ? (
          <Texto
            variante="secundario"
            tono="secundario"
            testID="privacidad-consentimiento"
            accessibilityLabel={etiquetaAccesibleConsentimiento(
              vista.consentimiento.version,
              vista.consentimiento.fecha,
            )}
          >
            {textoConsentimiento(vista.consentimiento.version, vista.consentimiento.fecha)}
          </Texto>
        ) : (
          <Texto variante="secundario" tono="secundario" testID="privacidad-sin-consentimiento">
            {TEXTO_SIN_CONSENTIMIENTO}
          </Texto>
        )}
      </Tarjeta>

      <Tarjeta testID="privacidad-permisos">
        <Texto testID="privacidad-permisos-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_PERMISOS}
        </Texto>
        {permisosTelefono().map((p) => (
          <View key={p.nombre} style={{ gap: espacio.xs }}>
            <Texto variante="cuerpo">{p.nombre}</Texto>
            <Texto variante="secundario" tono="secundario">
              {p.para}
            </Texto>
          </View>
        ))}
        <Boton
          testID="privacidad-ajustes-telefono"
          variante="secundario"
          etiqueta={BTN_PERMISOS_TELEFONO}
          pista={pistaPermisosTelefono()}
          alPresionar={() => void Linking.openSettings().catch(() => {})}
        />
      </Tarjeta>

      <Tarjeta testID="privacidad-datos">
        <Texto testID="privacidad-datos-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_DATOS}
        </Texto>
        <Texto variante="secundario" tono="secundario">
          {TEXTO_DESCARGA_GRATIS}
        </Texto>
        <Boton
          testID="privacidad-exportar-json"
          variante="secundario"
          etiqueta={BTN_EXPORTAR_JSON}
          pista={PISTA_EXPORTAR_JSON}
          cargando={exportando === 'json'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('json')}
        />
        <Boton
          testID="privacidad-exportar-csv"
          variante="secundario"
          etiqueta={BTN_EXPORTAR_CSV}
          pista={PISTA_EXPORTAR_CSV}
          cargando={exportando === 'csv'}
          deshabilitado={exportando !== null}
          alPresionar={() => void exportar('csv')}
        />
        <Boton
          testID="privacidad-aviso"
          variante="texto"
          ancho="contenido"
          etiqueta={BTN_LEER_AVISO}
          pista={PISTA_LEER_AVISO}
          alPresionar={alLeerAviso}
        />
        <Boton
          testID="privacidad-terminos"
          variante="texto"
          ancho="contenido"
          etiqueta={BTN_LEER_TERMINOS}
          pista={PISTA_LEER_TERMINOS}
          alPresionar={alLeerTerminos}
        />
        <Texto variante="secundario" tono="secundario" accessibilityLabel={etiquetaAccesibleDerechosArco()}>
          {textoDerechosArco()}
        </Texto>
        {mensaje ? (
          <Texto
            testID="privacidad-mensaje"
            variante="secundario"
            tono="faltante"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {mensaje}
          </Texto>
        ) : null}
      </Tarjeta>

      <TarjetaRespaldo alRestaurar={alRestaurar} />

      <Tarjeta testID="privacidad-borrar">
        <Texto testID="privacidad-borrar-titulo" variante="subtitulo" accessibilityRole="header">
          {SECCION_BORRAR}
        </Texto>
        {confirmando ? (
          <>
            <Texto variante="cuerpo">{TEXTO_BORRAR_ADVERTENCIA}</Texto>
            <CampoTexto
              testID="privacidad-borrar-palabra"
              etiqueta={etiquetaConfirmarBorrar()}
              valor={palabra}
              alCambiar={setPalabra}
              nativo={{ autoCapitalize: 'characters', autoCorrect: false }}
            />
            <Boton
              testID="privacidad-borrar-confirmar"
              etiqueta={BTN_BORRAR_CONFIRMAR}
              pista={PISTA_BORRAR_CONFIRMAR}
              deshabilitado={palabra.trim().toUpperCase() !== PALABRA_BORRAR}
              cargando={borrando}
              alPresionar={() => {
                setBorrando(true);
                void alBorrarTodo();
              }}
            />
            <Boton
              testID="privacidad-borrar-cancelar"
              variante="texto"
              etiqueta={BTN_CANCELAR}
              pista={PISTA_BORRAR_CANCELAR}
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
            etiqueta={BTN_BORRAR_INICIAR}
            pista={PISTA_BORRAR_INICIAR}
            alPresionar={() => setConfirmando(true)}
          />
        )}
      </Tarjeta>
    </View>
  );
}
