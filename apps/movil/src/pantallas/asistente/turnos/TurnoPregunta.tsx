import { View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { Chip, espacio, Texto } from '../../../ui';
import { CHIP_ESCRIBIR_RESPUESTA, PISTA_ESCRIBIR_RESPUESTA, TEXTO_DIMELO_RESPUESTA } from '../textos';
import { Burbuja } from './Burbuja';

/**
 * Una pregunta a la vez (02-UX §1.2): chips con la respuesta más probable primero. Nunca un campo de formulario en la
 * conversación: si la respuesta es una cifra, una fecha o un texto, se dice con el micrófono o se escribe en el campo
 * de abajo («Escribirlo» lo abre); la pantalla manda lo dicho a `responder`.
 */
export function TurnoPregunta({
  turno,
  testID,
  activa,
  alEscribir,
}: {
  turno: Extract<Turno, { clase: 'pregunta' }>;
  testID: string;
  /** Solo la última pregunta se contesta; las anteriores quedan como texto. */
  activa: boolean;
  /** Abre el campo de la barra de voz para escribir la respuesta. */
  alEscribir?: () => void;
}) {
  const libre = turno.campo !== undefined;
  return (
    <Burbuja testID={testID}>
      <Texto variante="cuerpo" testID={`${testID}-texto`}>
        {turno.texto}
      </Texto>
      {turno.ayuda ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-ayuda`}>
          {turno.ayuda}
        </Texto>
      ) : null}
      {activa && libre ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-dimelo`}>
          {TEXTO_DIMELO_RESPUESTA}
        </Texto>
      ) : null}
      {activa && (turno.chips.length > 0 || (libre && alEscribir)) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
          {turno.chips.map((c, i) => (
            <Chip
              key={c.valor}
              etiqueta={c.etiqueta}
              seleccionado={false}
              pista={i === 0 ? `${c.etiqueta}. Es la respuesta más probable` : c.etiqueta}
              alPresionar={() => turno.responder({ tipo: 'chip', valor: c.valor })}
              testID={`${testID}-chip-${c.valor}`}
            />
          ))}
          {libre && alEscribir ? (
            <Chip
              etiqueta={CHIP_ESCRIBIR_RESPUESTA}
              seleccionado={false}
              pista={PISTA_ESCRIBIR_RESPUESTA}
              alPresionar={alEscribir}
              testID={`${testID}-escribir`}
            />
          ) : null}
        </View>
      ) : null}
    </Burbuja>
  );
}
