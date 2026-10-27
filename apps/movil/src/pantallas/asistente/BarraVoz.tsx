import { View } from 'react-native';
import { Boton, CampoTexto, espacio, radio, sombra, Texto, useAnunciar, useTema } from '../../ui';
import {
  IndicadorVoz,
  abrirAjustesDictado,
  BTN_ABRIR_AJUSTES_DICTADO,
  ETIQUETA_ESCUCHANDO,
  PISTA_ABRIR_AJUSTES_DICTADO,
  TEXTO_TE_ESCUCHO,
} from '../../voz';
import { EJEMPLO_CAMPO_REGISTRAR, mensajeEsperandoConexion } from '../principal/textos';
import { DockVoz } from '../navegacion/DockVoz';
import { MicrofonoAsistente } from './MicrofonoAsistente';
import { OndaVoz, PuntosPensando } from './movimiento';
import {
  BTN_CANCELAR_ESCUCHA,
  BTN_ME_ALCANZA,
  PISTA_DOCK_ME_ALCANZA,
  PISTA_CANCELAR_ESCUCHA,
  TEXTO_TERMINO_SOLO,
  BTN_ENVIAR_REGISTRO,
  BTN_FORMULARIO,
  ETIQUETA_CAMPO_REGISTRAR,
  ETIQUETA_CERRAR_TECLADO,
  ETIQUETA_TECLADO,
  PISTA_FORMULARIO,
  PISTA_TECLADO,
  TEXTO_ESPERO_SI,
  TEXTO_INTERPRETANDO,
} from './textos';
import type { Asistente } from './useAsistente';

/**
 * Pie del asistente (dirección B): encima, lo que se va oyendo y el estado («Un segundo…») y el campo para escribir;
 * abajo, el dock de voz verde pino con «Escribir», el micrófono y «¿Me alcanza?». Los atajos de intención viven en
 * «Puedes decirme» del reposo.
 */
export function BarraVoz({ a }: { a: Asistente }) {
  const { c, esquema } = useTema();
  const m = a.microfono;
  // VoiceOver no lee regiones vivas: el error del dictado se anuncia en iPhone.
  useAnunciar(m.aviso);
  // Lo escrito se manda y el campo se cierra: con el teclado arriba, el campo, los chips y el micrófono dejan a la
  // conversación sin alto (unos 17 pt en un iPhone 16 Pro Max) y la respuesta («Registré…», «Entendí») no se veía
  // (Maestro 06). Para escribir otra frase, el botón del teclado lo vuelve a abrir.
  const enviarEscrito = () => {
    if (a.texto.trim() === '' || a.interpretando) return;
    a.enviar(a.texto, 'texto');
    a.setEscribiendo(false);
  };
  return (
    <View style={{ gap: espacio.m }} testID="barra-voz">
      {m.escuchando || a.escuchandoConfirmacion ? (
        // Hoja «escuchando»: «Te escucho…», la onda viva y lo que se va oyendo; el orbe es «Terminar».
        <View
          testID="hoja-escuchando"
          style={{
            gap: espacio.m,
            padding: espacio.l,
            borderRadius: radio.xl,
            backgroundColor: c.superficie,
            borderWidth: 1.5,
            borderColor: c.acentoTexto,
            ...sombra.tarjeta[esquema],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: espacio.s,
            }}
          >
            <Texto variante="etiqueta" tono="acento">
              {a.escuchandoConfirmacion && !m.escuchando ? TEXTO_ESPERO_SI : TEXTO_TE_ESCUCHO}
            </Texto>
            <Texto variante="pequeno" tono="secundario" style={{ flexShrink: 1, textAlign: 'right' }}>
              {TEXTO_TERMINO_SOLO}
            </Texto>
          </View>
          <OndaVoz activa />
          {m.escuchando ? (
            <Texto
              variante="cuerpo"
              accessibilityLiveRegion="polite"
              accessibilityLabel={m.parcial === '' ? ETIQUETA_ESCUCHANDO : undefined}
              testID="transcripcion-en-vivo"
            >
              {m.parcial === '' ? ' ' : m.parcial}
            </Texto>
          ) : (
            <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="escuchando-confirmacion">
              {a.parcialConfirmacion === '' ? ' ' : a.parcialConfirmacion}
            </Texto>
          )}
          {m.escuchando ? (
            <Boton
              etiqueta={BTN_CANCELAR_ESCUCHA}
              variante="texto"
              ancho="contenido"
              pista={PISTA_CANCELAR_ESCUCHA}
              alPresionar={m.cancelar}
              testID="boton-cancelar-escucha"
            />
          ) : null}
        </View>
      ) : null}
      {m.aviso ? (
        <Texto
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {m.aviso}
        </Texto>
      ) : null}
      {m.sinPermiso ? (
        <Boton
          etiqueta={BTN_ABRIR_AJUSTES_DICTADO}
          variante="texto"
          ancho="contenido"
          pista={PISTA_ABRIR_AJUSTES_DICTADO}
          alPresionar={abrirAjustesDictado}
          testID="boton-abrir-ajustes-dictado"
        />
      ) : null}
      {a.interpretando ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <PuntosPensando />
          <Texto
            variante="secundario"
            tono="secundario"
            accessibilityLiveRegion="polite"
            testID="interpretando"
          >
            {TEXTO_INTERPRETANDO}
          </Texto>
        </View>
      ) : null}
      {a.esperandoConexion > 0 ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID="indicador-esperando-conexion"
        >
          {mensajeEsperandoConexion(a.esperandoConexion)}
        </Texto>
      ) : null}

      {a.escribiendo ? (
        <View style={{ gap: espacio.s }}>
          <CampoTexto
            etiqueta={ETIQUETA_CAMPO_REGISTRAR}
            valor={a.texto}
            alCambiar={a.setTexto}
            ejemplo={EJEMPLO_CAMPO_REGISTRAR}
            autoFocus
            alEnviar={enviarEscrito}
            nativo={{ returnKeyType: 'send', autoCorrect: false }}
            testID="campo-registrar"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            <Boton
              etiqueta={BTN_ENVIAR_REGISTRO}
              alPresionar={enviarEscrito}
              deshabilitado={a.texto.trim() === '' || a.interpretando}
              testID="boton-enviar-registro"
              style={{ flex: 1 }}
            />
            <Boton
              etiqueta={BTN_FORMULARIO}
              variante="texto"
              ancho="contenido"
              pista={PISTA_FORMULARIO}
              alPresionar={a.abrirFormulario}
              testID="boton-formulario"
            />
          </View>
        </View>
      ) : null}

      {/* Mientras el asistente habla, la onda sobre el dock (tocar cualquier cosa lo calla). */}
      {a.hablando ? (
        <View style={{ alignItems: 'center' }}>
          <IndicadorVoz activo alto={20} testID="asistente-hablando" />
        </View>
      ) : null}
      <DockVoz
        izquierda={{
          etiqueta: ETIQUETA_TECLADO,
          icono: 'teclado',
          alPresionar: () => a.setEscribiendo((v) => !v),
          testID: 'boton-escribir',
          etiquetaAccesible: a.escribiendo ? ETIQUETA_CERRAR_TECLADO : ETIQUETA_TECLADO,
          ...(a.escribiendo ? {} : { pista: PISTA_TECLADO }),
          abierto: a.escribiendo,
        }}
        centro={<MicrofonoAsistente escuchando={m.escuchando} boton={m.boton} />}
        derecha={{
          etiqueta: BTN_ME_ALCANZA,
          alPresionar: a.preguntarMeAlcanza,
          testID: 'dock-me-alcanza',
          pista: PISTA_DOCK_ME_ALCANZA,
        }}
      />
    </View>
  );
}
