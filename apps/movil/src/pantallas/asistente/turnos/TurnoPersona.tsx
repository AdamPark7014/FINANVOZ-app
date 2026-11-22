import { Text, View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { FUENTE, espacio, Icono, useTema } from '../../../ui';
import { etiquetaTurnoPersona } from '../textos';

/**
 * Lo que dijiste o escribiste: tu frase a la derecha en una burbuja suave (solo tú llevas burbuja), con un
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
        paddingVertical: espacio.s,
        paddingHorizontal: espacio.m + 2,
        borderRadius: 20,
        borderBottomRightRadius: 6,
        backgroundColor: c.superficieAlterna,
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
          fontSize: 16,
          lineHeight: 22,
          color: c.texto,
        }}
      >
        {turno.texto}
      </Text>
    </View>
  );
}
