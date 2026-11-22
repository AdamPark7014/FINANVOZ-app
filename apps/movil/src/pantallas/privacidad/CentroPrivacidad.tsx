import { useState } from 'react';
import { Linking, View } from 'react-native';
import { exportarCsv, exportarJson, fijarEstadisticas, obtenerCentroPrivacidad } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, Texto, useTema } from '../../ui';
import { CeldaGrupo, Fila as FilaLista, FilaInterruptor, Grupo, IconoFila } from '../../ui/componentes/Lista';
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
import { ESTILO_TITULO_PANTALLA } from '../../ui/componentes/Lista';

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
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  alLeerAviso: () => void;
  alLeerTerminos: () => void;
  /** La raíz cierra la base, destruye la llave y vuelve al onboarding. */
  alBorrarTodo: () => Promise<void>;
  /** Abre "Restaurar un respaldo" (M9). */
  alRestaurar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const { c } = useTema();
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
      {alVolver ? (
        <Boton
          testID="privacidad-volver"
          variante="texto"
          ancho="contenido"
          etiqueta={ETIQUETA_VOLVER}
          etiquetaAccesible={ACCESIBILIDAD_VOLVER}
          pista={PISTA_VOLVER}
          alPresionar={alVolver}
        />
      ) : null}
      <Texto
        testID="privacidad-titulo"
        variante="titulo"
        accessibilityRole="header"
        style={ESTILO_TITULO_PANTALLA}
      >
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

      <Grupo
        testID="privacidad-guardado"
        titulo={SECCION_GUARDADO}
        testIDTitulo="privacidad-guardado-titulo"
        nota={NOTA_CIFRADO_GUARDADO}
      >
        {guardadoVacio(g) ? (
          <CeldaGrupo>
            <Texto testID="privacidad-guardado-vacio" variante="cuerpo" tono="secundario">
              {TEXTO_GUARDADO_VACIO}
            </Texto>
          </CeldaGrupo>
        ) : (
          <CeldaGrupo>
            {lineasGuardado(g).map((linea) => (
              <View
                key={linea}
                accessible
                accessibilityLabel={etiquetaLineaGuardado(linea)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: espacio.m,
                  paddingVertical: espacio.xxs,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 9,
                    backgroundColor: c.acentoTexto,
                  }}
                />
                <Texto variante="cuerpo" style={{ flex: 1 }} importantForAccessibility="no">
                  {linea}
                </Texto>
              </View>
            ))}
          </CeldaGrupo>
        )}
      </Grupo>

      <Grupo
        testID="privacidad-sale"
        titulo={SECCION_SALE}
        testIDTitulo="privacidad-sale-titulo"
        nota={NOTA_SERVICIOS_FUERA_MX}
      >
        {saleDelTelefono().map((s) => (
          <FilaLista key={s.que} titulo={s.que} apoyo={s.quien} />
        ))}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            paddingHorizontal: espacio.l,
            paddingVertical: espacio.m,
          }}
        >
          <IconoFila icono="escudo" familia="super" />
          <Texto variante="cuerpo" style={{ flex: 1, fontWeight: '600' }}>
            {TEXTO_NUNCA_SALEN}
          </Texto>
        </View>
      </Grupo>

      <Grupo
        testID="privacidad-decisiones"
        titulo={SECCION_DECISIONES}
        testIDTitulo="privacidad-decisiones-titulo"
      >
        <FilaInterruptor
          testID="privacidad-estadisticas"
          titulo={ETIQUETA_ESTADISTICAS}
          apoyo={DESC_ESTADISTICAS}
          valor={vista.estadisticas}
          alCambiar={cambiarEstadisticas}
        />
        <CeldaGrupo>
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
        </CeldaGrupo>
      </Grupo>

      <Grupo testID="privacidad-permisos" titulo={SECCION_PERMISOS} testIDTitulo="privacidad-permisos-titulo">
        {permisosTelefono().map((p) => (
          <FilaLista key={p.nombre} titulo={p.nombre} apoyo={p.para} />
        ))}
        <CeldaGrupo>
          <Boton
            testID="privacidad-ajustes-telefono"
            variante="secundario"
            etiqueta={BTN_PERMISOS_TELEFONO}
            pista={pistaPermisosTelefono()}
            alPresionar={() => void Linking.openSettings().catch(() => {})}
          />
        </CeldaGrupo>
      </Grupo>

      <Grupo testID="privacidad-datos" titulo={SECCION_DATOS} testIDTitulo="privacidad-datos-titulo">
        <CeldaGrupo>
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
        </CeldaGrupo>
      </Grupo>

      <TarjetaRespaldo alRestaurar={alRestaurar} />

      <Grupo testID="privacidad-borrar" titulo={SECCION_BORRAR} testIDTitulo="privacidad-borrar-titulo">
        <CeldaGrupo>
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
        </CeldaGrupo>
      </Grupo>
    </View>
  );
}
