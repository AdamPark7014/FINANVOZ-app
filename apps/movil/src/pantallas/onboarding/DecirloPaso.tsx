import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Boton, espacio, Tarjeta, Texto, useDictadoCampos, type AvisoDictadoCampo } from '../../ui';

export const TITULO_DECIRLO = 'O dímelo';
export const textoEntendido = (oido: string) => `Oí «${oido}». Revisa los datos y toca Continuar.`;
export const textoNoEntendido = (oido: string) =>
  `Oí «${oido}», pero no lo entendí. Prueba como en el ejemplo o llena los datos.`;

/**
 * «O dímelo» de un paso del onboarding (`02 §3`): toca el micrófono, di el paso completo y se llenan los datos de
 * la pantalla. Nunca guarda: la persona revisa y toca Continuar. Sin dictado en el teléfono no aparece.
 */
export function DecirloPaso<T>({
  ejemplo,
  interpretar,
  alEntender,
  testID,
}: {
  /** Frase de ejemplo, sin comillas: «gano doce mil cada quincena». */
  ejemplo: string;
  interpretar: (texto: string) => T | null;
  alEntender: (resultado: T) => void;
  testID: string;
}) {
  const dictado = useDictadoCampos();
  const [aviso, setAviso] = useState<AvisoDictadoCampo | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  if (!dictado) return null;
  const { BotonDictar } = dictado;
  return (
    <Tarjeta testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
        <View style={{ flex: 1, gap: espacio.xs }}>
          <Texto variante="subtitulo">{TITULO_DECIRLO}</Texto>
          <Texto variante="secundario" tono="secundario">{`Por ejemplo: «${ejemplo}»`}</Texto>
        </View>
        <BotonDictar
          etiquetaCampo="este paso"
          testID={`${testID}-dictar`}
          alAviso={setAviso}
          alOir={(oido) => {
            const r = interpretar(oido);
            if (r === null) {
              setResultado(textoNoEntendido(oido));
              return;
            }
            alEntender(r);
            setResultado(textoEntendido(oido));
          }}
        />
      </View>
      {aviso ? (
        <Texto variante="secundario" tono="secundario" accessibilityLiveRegion="polite">
          {aviso.texto}
        </Texto>
      ) : resultado ? (
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLiveRegion="polite"
          testID={`${testID}-resultado`}
        >
          {resultado}
        </Texto>
      ) : null}
      {aviso?.sinPermiso ? (
        <Boton
          etiqueta="Abrir ajustes"
          variante="texto"
          ancho="contenido"
          pista="Abre los ajustes del teléfono para permitir el micrófono"
          alPresionar={() => void Linking.openSettings().catch(() => {})}
        />
      ) : null}
    </Tarjeta>
  );
}
