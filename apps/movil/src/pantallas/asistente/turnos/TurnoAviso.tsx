import { useState } from 'react';
import { View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { mensajeError } from '../../../servicios';
import { espacio, Texto } from '../../../ui';
import { BotonPildora } from '../../../ui/componentes/BotonPildora';
import { Burbuja } from './Burbuja';
import { TurnoPuedoGastar } from './TurnoPuedoGastar';

/**
 * La app habla primero (tarjeta que vence, «Lo que veo», riesgo, efectivo; tablero B1): la frase en texto grande, el
 * detalle y las respuestas de un toque en píldoras, la más probable primero (02-UX §1.2). «¿Me alcanza?» contestado
 * trae su propio dibujo (`TurnoPuedoGastar`, B3).
 */
export function TurnoAviso({ turno, testID }: { turno: Extract<Turno, { clase: 'aviso' }>; testID: string }) {
  const [error, setError] = useState<string | null>(null);
  if (turno.puedoGastar) return <TurnoPuedoGastar turno={turno} datos={turno.puedoGastar} testID={testID} />;
  return (
    <Burbuja testID={testID}>
      <Texto
        variante="voz"
        tono={turno.origen === 'riesgo' ? 'faltante' : 'normal'}
        testID={`${testID}-texto`}
      >
        {turno.texto}
      </Texto>
      {turno.detalle ? (
        <Texto variante="secundario" tono="secundario">
          {turno.detalle}
        </Texto>
      ) : null}
      {turno.acciones.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
          {turno.acciones.map((a, i) => (
            <BotonPildora
              key={a.etiqueta}
              etiqueta={a.etiqueta}
              testID={a.testID ?? `${testID}-accion-${i}`}
              {...(a.pista ? { pista: a.pista } : {})}
              alPresionar={() => {
                setError(null);
                Promise.resolve()
                  .then(() => a.accion())
                  .catch((e: unknown) => setError(mensajeError(e)));
              }}
            />
          ))}
        </View>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
    </Burbuja>
  );
}
