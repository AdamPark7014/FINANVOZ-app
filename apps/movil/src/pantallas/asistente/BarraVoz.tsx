import { Pressable, ScrollView, View } from 'react-native';
import {
  Boton,
  CampoTexto,
  Chip,
  espacio,
  hitSlopTactil,
  OBJETIVO_TACTIL_MIN,
  radio,
  sombra,
  Texto,
  useAnunciar,
  useTema,
} from '../../ui';
import {
  IndicadorVoz,
  abrirAjustesDictado,
  BTN_ABRIR_AJUSTES_DICTADO,
  ETIQUETA_ESCUCHANDO,
  PISTA_ABRIR_AJUSTES_DICTADO,
  TEXTO_TE_ESCUCHO,
} from '../../voz';
import { EJEMPLO_CAMPO_REGISTRAR, mensajeEsperandoConexion } from '../principal/textos';
import { MicrofonoAsistente } from './MicrofonoAsistente';
import { OndaVoz, PuntosPensando } from './movimiento';
import {
  BTN_CANCELAR_ESCUCHA,
  PISTA_CANCELAR_ESCUCHA,
  TEXTO_TERMINO_SOLO,
  BTN_ENVIAR_REGISTRO,
  BTN_FORMULARIO,
  ETIQUETA_CAMPO_REGISTRAR,
  ETIQUETA_CERRAR_TECLADO,
  ETIQUETA_CHIPS_INTENCION,
  ETIQUETA_TECLADO,
  PISTA_FORMULARIO,
  PISTA_TECLADO,
  TEXTO_ESPERO_SI,
  TEXTO_INTERPRETANDO,
} from './textos';
import type { Asistente } from './useAsistente';

/** Tamaño del micrófono en la barra: un poco más grande que la maqueta (72) para que mande la voz. */
export const TAMANO_MICROFONO = 80;

/**
 * Pie del asistente (maqueta Hoy A): chips de intención, el micrófono de 72 pt al centro (mantener o tocar) y el
 * teclado a la derecha, que abre el campo en línea. Encima, lo que se va oyendo y el estado («Déjame entenderlo…»).
 * Sin micrófono (estado vacío: el grande está al centro de la pantalla) quedan los chips y el teclado.
 */
export function BarraVoz({ a, conMicrofono = true }: { a: Asistente; conMicrofono?: boolean }) {
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

      {a.chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={ETIQUETA_CHIPS_INTENCION}
          contentContainerStyle={{ gap: espacio.s, paddingVertical: espacio.xs }}
          testID="chips-intencion"
        >
          {a.chips.map((chip) => (
            <Chip
              key={chip.clave}
              etiqueta={chip.etiqueta}
              seleccionado={false}
              pista={chip.pista}
              alPresionar={() => a.tocarChip(chip)}
              testID={`chip-intencion-${chip.clave}`}
            />
          ))}
        </ScrollView>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: conMicrofono ? TAMANO_MICROFONO : OBJETIVO_TACTIL_MIN,
        }}
      >
        {/* Mientras el asistente habla, la onda a la izquierda del micrófono (tocar cualquier cosa lo calla). */}
        <View style={{ width: OBJETIVO_TACTIL_MIN, alignItems: 'center' }}>
          {a.hablando ? <IndicadorVoz activo alto={20} testID="asistente-hablando" /> : null}
        </View>
        {conMicrofono ? <MicrofonoAsistente escuchando={m.escuchando} boton={m.boton} /> : <View />}
        <Pressable
          testID="boton-escribir"
          onPress={() => a.setEscribiendo((v) => !v)}
          hitSlop={hitSlopTactil}
          accessibilityRole="button"
          accessibilityLabel={a.escribiendo ? ETIQUETA_CERRAR_TECLADO : ETIQUETA_TECLADO}
          accessibilityHint={a.escribiendo ? undefined : PISTA_TECLADO}
          accessibilityState={{ expanded: a.escribiendo }}
          style={({ pressed }) => ({
            width: OBJETIVO_TACTIL_MIN,
            height: OBJETIVO_TACTIL_MIN,
            borderRadius: radio.pastilla,
            borderWidth: 1,
            borderColor: a.escribiendo ? c.acentoTexto : c.borde,
            backgroundColor: a.escribiendo || pressed ? c.superficieAlterna : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: a.escribiendo ? 1 : 0.72,
          })}
        >
          <IconoTeclado color={a.escribiendo ? c.acentoTexto : c.textoSecundario} />
        </Pressable>
      </View>
    </View>
  );
}

/** Teclado dibujado con vistas (la app no usa fuentes de íconos). */
function IconoTeclado({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 22,
        height: 15,
        borderRadius: 3,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 2, height: 2, backgroundColor: color }} />
        ))}
      </View>
      <View style={{ width: 10, height: 2, backgroundColor: color }} />
    </View>
  );
}
