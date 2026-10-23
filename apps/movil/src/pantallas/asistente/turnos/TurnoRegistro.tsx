import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { mensajeError } from '../../../servicios';
import { espacio, etiquetaHablada, OBJETIVO_TACTIL_MIN, Texto } from '../../../ui';
import { BTN_DESHACER, PISTA_DESHACER } from '../textos';
import { AccionTexto, Burbuja } from './Burbuja';

/**
 * «Registré Coca $25 · Antojos · Efectivo.» con «Tu día pasa de $220 a $214.» y Deshacer (02-UX §1.3). Tocar la
 * frase abre el movimiento. Si Deshacer falla, el error se queda en el turno.
 */
export function TurnoRegistro({
  turno,
  testID,
}: {
  turno: Extract<Turno, { clase: 'registro' }>;
  testID: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const deshacer = turno.deshacer;
  const texto = (
    <Texto variante="cuerpo" testID={`${testID}-texto`}>
      {turno.texto}
    </Texto>
  );
  return (
    <Burbuja testID={testID}>
      {turno.abrir ? (
        <Pressable
          onPress={turno.abrir}
          accessibilityRole="button"
          accessibilityLabel={etiquetaHablada(turno.texto)}
          accessibilityHint="Abre el movimiento"
          style={{ minHeight: OBJETIVO_TACTIL_MIN, justifyContent: 'center' }}
        >
          {texto}
        </Pressable>
      ) : (
        texto
      )}
      {turno.detalle ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-detalle`}>
          {turno.detalle}
        </Texto>
      ) : null}
      {turno.cambioDia || deshacer ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            columnGap: espacio.s,
          }}
        >
          {turno.cambioDia ? (
            <Texto
              variante="secundario"
              tono="secundario"
              style={{ flexShrink: 1 }}
              testID={`${testID}-cambio`}
            >
              {turno.cambioDia}
            </Texto>
          ) : (
            <View />
          )}
          {deshacer ? (
            <AccionTexto
              etiqueta={BTN_DESHACER}
              pista={PISTA_DESHACER}
              testID={`${testID}-deshacer`}
              alPresionar={() => {
                setError(null);
                Promise.resolve()
                  .then(() => deshacer())
                  .catch((e: unknown) => setError(mensajeError(e)));
              }}
            />
          ) : null}
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
