import { Text, View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { FUENTE, espacio, Icono, useTema } from '../../../ui';
import { etiquetaTurnoPersona } from '../textos';

/**
 * Lo que dijiste o escribiste (premium, 08-11): tu frase en chico a la derecha, como una transcripción, con un
 * micrófono si fue por voz. Lo importante es lo que contesta el asistente.
 */
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
        maxWidth: '82%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.xs + 2,
        paddingVertical: espacio.xs,
      }}
    >
      {turno.porVoz ? (
        <View testID={`${testID}-voz`}>
          <Icono nombre="microfono" color={c.textoSecundario} tamano={14} grosor={1.8} />
        </View>
      ) : null}
      <Text
        importantForAccessibility="no"
        style={{
          fontFamily: FUENTE,
          flexShrink: 1,
          fontSize: 15,
          lineHeight: 21,
          color: c.textoSecundario,
        }}
      >
        {turno.texto}
      </Text>
    </View>
  );
}
