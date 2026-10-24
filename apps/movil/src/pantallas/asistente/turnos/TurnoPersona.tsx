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
        maxWidth: '88%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        backgroundColor: c.superficieAlterna,
        borderWidth: 1,
        borderColor: c.borde,
        borderTopLeftRadius: radio.xl,
        borderTopRightRadius: radio.xl,
        borderBottomLeftRadius: radio.xl,
        borderBottomRightRadius: radio.s,
        paddingVertical: espacio.s,
        paddingHorizontal: espacio.l,
      }}
    >
      {turno.porVoz ? (
        <View style={{ transform: [{ scale: 0.75 }] }} testID={`${testID}-voz`}>
          <IconoMicrofono color={c.acentoTexto} />
        </View>
      ) : null}
      <Texto variante="cuerpo" style={{ flexShrink: 1 }} importantForAccessibility="no">
        {turno.texto}
      </Texto>
    </View>
  );
}
