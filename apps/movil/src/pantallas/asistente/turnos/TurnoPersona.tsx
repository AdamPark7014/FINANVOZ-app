import { Text, View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { FUENTE, espacio, Icono, useTema } from '../../../ui';
import { etiquetaTurnoPersona } from '../textos';

/**
 * Lo que dijiste o escribiste (dirección B, tablero B2): una burbuja verde pino a la derecha, con el micrófono menta
 * si fue por voz. Lo que dice el asistente va sin burbuja; esto es lo único que la lleva.
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
        gap: espacio.s,
        backgroundColor: c.dock,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 6,
        paddingVertical: espacio.m,
        paddingHorizontal: espacio.l,
      }}
    >
      {turno.porVoz ? (
        <View testID={`${testID}-voz`}>
          <Icono nombre="microfono" color={c.microfono} tamano={16} grosor={2.2} />
        </View>
      ) : null}
      <Text
        importantForAccessibility="no"
        style={{
          fontFamily: FUENTE,
          flexShrink: 1,
          fontSize: 17,
          lineHeight: 23,
          fontWeight: '500',
          color: c.sobreDock,
        }}
      >
        {turno.texto}
      </Text>
    </View>
  );
}
