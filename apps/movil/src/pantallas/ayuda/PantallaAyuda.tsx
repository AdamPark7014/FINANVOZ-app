import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Boton, espacio, OBJETIVO_TACTIL_MIN, Tarjeta, Texto, useTema } from '../../ui';
import { CORREO_AYUDA, enlaceCorreoAyuda, PREGUNTAS_FRECUENTES, type PreguntaFrecuente } from './preguntas';

/**
 * Ayuda (CA-M13-04): las preguntas frecuentes de `preguntas.ts` (se abren una a una) y el correo de contacto.
 * El correo se abre con `mailto:` y solo el asunto: la persona decide qué contar (regla 9). Si el teléfono no
 * tiene app de correo, se muestra la dirección para escribirla a mano.
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
    abrirEnlace(enlaceCorreoAyuda()).catch(() => setSinCorreo(true));
  };

  return (
    <>
      <Boton
        testID="ayuda-volver"
        variante="texto"
        ancho="contenido"
        etiqueta="Volver"
        alPresionar={alVolver}
      />
      <Texto variante="titulo">Ayuda</Texto>
      <Texto variante="cuerpo" tono="secundario">
        Las dudas más comunes. Toca una pregunta para ver la respuesta.
      </Texto>

      <View style={{ gap: espacio.s }} testID="ayuda-preguntas">
        {PREGUNTAS_FRECUENTES.map((p) => (
          <Pregunta
            key={p.id}
            p={p}
            abierta={abierta === p.id}
            alTocar={() => setAbierta((a) => (a === p.id ? null : p.id))}
          />
        ))}
      </View>

      <Tarjeta testID="ayuda-contacto">
        <Texto variante="subtitulo">¿No encontraste tu respuesta?</Texto>
        <Texto variante="cuerpo">
          {`Escríbenos a ${CORREO_AYUDA}. Cuéntanos qué pasó; nunca nos mandes contraseñas ni los datos de tus tarjetas.`}
        </Texto>
        <Boton
          testID="ayuda-escribir"
          variante="secundario"
          etiqueta="Escribir un correo"
          pista="Abre tu app de correo"
          alPresionar={escribir}
        />
        {sinCorreo ? (
          <Texto
            variante="secundario"
            tono="faltante"
            accessibilityLiveRegion="polite"
            testID="ayuda-sin-correo"
          >
            {`No encontré una app de correo en tu teléfono. Escríbenos desde tu correo a ${CORREO_AYUDA}.`}
          </Texto>
        ) : null}
      </Tarjeta>
    </>
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
          <Texto variante="cuerpoFuerte">{p.pregunta}</Texto>
        </View>
        <Texto
          variante="cuerpoFuerte"
          style={{ color: c.acentoTexto }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {abierta ? '−' : '+'}
        </Texto>
      </Pressable>
      {abierta ? (
        <View style={{ gap: espacio.s }} testID={`ayuda-respuesta-${p.id}`}>
          {p.respuesta.map((parrafo) => (
            <Texto key={parrafo} variante="cuerpo">
              {parrafo}
            </Texto>
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}
