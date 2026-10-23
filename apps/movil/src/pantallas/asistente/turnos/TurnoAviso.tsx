import { useState } from 'react';
import { View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { mensajeError } from '../../../servicios';
import { Chip, espacio, Texto } from '../../../ui';
import { Burbuja } from './Burbuja';

/**
 * La app habla primero (tarjeta que vence, «Lo que veo», riesgo, efectivo): frase, detalle y respuestas a un toque
 * como chips, la más probable primero (02-UX §1.2).
 */
export function TurnoAviso({ turno, testID }: { turno: Extract<Turno, { clase: 'aviso' }>; testID: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Burbuja testID={testID}>
      <Texto
        variante={turno.origen === 'riesgo' ? 'cuerpo' : 'cuerpoFuerte'}
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
            <Chip
              key={a.etiqueta}
              etiqueta={a.etiqueta}
              seleccionado={false}
              pista={a.etiqueta}
              testID={a.testID ?? `${testID}-accion-${i}`}
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
