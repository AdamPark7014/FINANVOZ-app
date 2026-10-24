import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Boton, espacio, OBJETIVO_TACTIL_MIN, Tarjeta, Texto, useTema } from '../../ui';
import { anunciar } from '../../ui/anunciar';
import { CORREO_AYUDA, enlaceCorreoAyuda, preguntasFrecuentes } from './preguntas';
import {
  ACCESIBILIDAD_ESCRIBIR_CORREO,
  ACCESIBILIDAD_VOLVER,
  PISTA_VOLVER,
  BTN_ESCRIBIR_CORREO,
  CONTACTO_TITULO,
  etiquetaAccesibleCuerpoContacto,
  etiquetaAccesibleParrafoRespuesta,
  etiquetaAccesibleSinAppCorreo,
  ETIQUETA_VOLVER,
  etiquetaAccesibleIntro,
  ICONO_PREGUNTA_ABIERTA,
  ICONO_PREGUNTA_CERRADA,
  INTRO,
  mensajeSinAppCorreo,
  PISTA_ESCRIBIR_CORREO,
  PREGUNTAS_TITULO,
  pistaPreguntaFrecuente,
  textoCuerpoContacto,
  TITULO,
  type PreguntaFrecuente,
} from './textos';

/**
 * Ayuda (CA-M13-04): las preguntas frecuentes de `textos.ts` (se abren una a una) y el correo de contacto.
 * El correo se abre con `mailto:` y solo el asunto: la persona decide qué contar (regla 9). Si el teléfono no
 * tiene app de correo (un iPhone sin Mail), se avisa y la dirección se puede copiar (texto seleccionable; la app no
 * trae `expo-clipboard`). Las respuestas usan la redacción de la plataforma (`preguntasFrecuentes`).
 */
export function PantallaAyuda({
  alVolver,
  abrirEnlace = (url) => Linking.openURL(url),
}: {
  alVolver: () => void;
  /** Inyectable en pruebas; por omisión `Linking.openURL`. */
  abrirEnlace?: (url: string) => Promise<unknown>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [sinCorreo, setSinCorreo] = useState(false);

  const escribir = () => {
    setSinCorreo(false);
    abrirEnlace(enlaceCorreoAyuda()).catch(() => {
      setSinCorreo(true);
      // VoiceOver no lee la región viva del aviso: en iPhone se anuncia aparte.
      anunciar(etiquetaAccesibleSinAppCorreo(CORREO_AYUDA));
    });
  };

  return (
    <View style={{ gap: espacio.xl }}>
      <Boton
        testID="ayuda-volver"
        variante="texto"
        ancho="contenido"
        etiqueta={ETIQUETA_VOLVER}
        etiquetaAccesible={ACCESIBILIDAD_VOLVER}
        pista={PISTA_VOLVER}
        alPresionar={alVolver}
      />
      <Texto variante="titulo" testID="ayuda-titulo" accessibilityRole="header">
        {TITULO}
      </Texto>
      <Texto
        variante="cuerpo"
        tono="secundario"
        testID="ayuda-intro"
        accessibilityLabel={etiquetaAccesibleIntro()}
      >
        {INTRO}
      </Texto>
      <Texto variante="subtitulo" testID="ayuda-preguntas-titulo" accessibilityRole="header">
        {PREGUNTAS_TITULO}
      </Texto>

      <View style={{ gap: espacio.s }} testID="ayuda-preguntas" accessibilityRole="list">
        {preguntasFrecuentes().map((p) => (
          <Pregunta
            key={p.id}
            p={p}
            abierta={abierta === p.id}
            alTocar={() => setAbierta((a) => (a === p.id ? null : p.id))}
          />
        ))}
      </View>

      <Tarjeta testID="ayuda-contacto">
        <Texto variante="subtitulo" testID="ayuda-contacto-titulo" accessibilityRole="header">
          {CONTACTO_TITULO}
        </Texto>
        <Texto
          variante="cuerpo"
          testID="ayuda-contacto-cuerpo"
          accessibilityLabel={etiquetaAccesibleCuerpoContacto(CORREO_AYUDA)}
          // Sin app de correo (o en iPhone sin Mail) la dirección se puede copiar manteniéndola presionada.
          selectable
        >
          {textoCuerpoContacto(CORREO_AYUDA)}
        </Texto>
        <Boton
          testID="ayuda-escribir"
          variante="secundario"
          etiqueta={BTN_ESCRIBIR_CORREO}
          etiquetaAccesible={ACCESIBILIDAD_ESCRIBIR_CORREO}
          pista={PISTA_ESCRIBIR_CORREO}
          alPresionar={escribir}
        />
        {sinCorreo ? (
          <Texto
            variante="secundario"
            tono="faltante"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            importantForAccessibility="yes"
            accessibilityLabel={etiquetaAccesibleSinAppCorreo(CORREO_AYUDA)}
            testID="ayuda-sin-correo"
            selectable
          >
            {mensajeSinAppCorreo(CORREO_AYUDA)}
          </Texto>
        ) : null}
      </Tarjeta>
    </View>
  );
}

function Pregunta({ p, abierta, alTocar }: { p: PreguntaFrecuente; abierta: boolean; alTocar: () => void }) {
  const { c } = useTema();
  return (
    <Tarjeta testID={`ayuda-${p.id}`}>
      <Pressable
        testID={`ayuda-pregunta-${p.id}`}
        onPress={alTocar}
        accessibilityRole="button"
        accessibilityLabel={p.pregunta}
        accessibilityHint={pistaPreguntaFrecuente(abierta)}
        accessibilityState={{ expanded: abierta }}
        style={({ pressed }) => ({
          minHeight: OBJETIVO_TACTIL_MIN,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.s,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Texto variante="cuerpoFuerte" importantForAccessibility="no">
            {p.pregunta}
          </Texto>
        </View>
        <Texto
          variante="cuerpoFuerte"
          style={{ color: c.acentoTexto }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {abierta ? ICONO_PREGUNTA_ABIERTA : ICONO_PREGUNTA_CERRADA}
        </Texto>
      </Pressable>
      {abierta ? (
        <View
          style={{ gap: espacio.s }}
          testID={`ayuda-respuesta-${p.id}`}
          accessibilityLiveRegion="polite"
          importantForAccessibility="yes"
        >
          {p.respuesta.map((parrafo, i) => (
            <Texto
              key={parrafo}
              variante="cuerpo"
              accessibilityLabel={etiquetaAccesibleParrafoRespuesta(parrafo, i === 0)}
            >
              {parrafo}
            </Texto>
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}
