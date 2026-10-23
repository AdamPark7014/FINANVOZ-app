import { View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { espacio, IconoMicrofono, radio, Texto, useTema } from '../../../ui';
import { etiquetaTurnoPersona } from '../textos';

/** Lo que dijiste o escribiste («dijiste», a la derecha); con micrófono si fue por voz. */
export function TurnoPersona({
  turno,
  testID,
}: {
  turno: Extract<Turno, { de: 'persona' }>;
  testID: string;
}) {
  const { c } = useTema();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={etiquetaTurnoPersona(turno.texto, turno.porVoz)}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '86%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        backgroundColor: c.superficieAlterna,
        borderTopLeftRadius: radio.l,
        borderTopRightRadius: radio.l,
        borderBottomLeftRadius: radio.l,
        borderBottomRightRadius: espacio.xs,
        paddingVertical: espacio.xs + 1,
        paddingHorizontal: espacio.m,
      }}
    >
      {turno.porVoz ? (
        <View style={{ transform: [{ scale: 0.7 }] }} testID={`${testID}-voz`}>
          <IconoMicrofono color={c.acentoTexto} />
        </View>
      ) : null}
      <Texto variante="secundario" style={{ flexShrink: 1 }} importantForAccessibility="no">
        {turno.texto}
      </Texto>
    </View>
  );
}
