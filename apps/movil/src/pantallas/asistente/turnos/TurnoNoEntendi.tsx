import { View } from 'react-native';
import type { Turno } from '../../../asistente/tipos';
import { Chip, espacio, Texto } from '../../../ui';
import { BTN_CORREGIR_OIDO, PISTA_CORREGIR_OIDO, textoNoEntendi } from '../textos';
import { AccionTexto, Burbuja } from './Burbuja';

/**
 * «No entendí» con reparación en un toque (maqueta «no entendí»): repite lo oído, las respuestas más probables
 * como chips en dos columnas y «Corregir lo que oí» abre la frase en el teclado.
 */
export function TurnoNoEntendi({
  turno,
  testID,
}: {
  turno: Extract<Turno, { clase: 'no_entendi' }>;
  testID: string;
}) {
  return (
    <Burbuja testID={testID}>
      <Texto variante="cuerpo" testID={`${testID}-texto`}>
        {textoNoEntendi(turno.oido)}
      </Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {turno.opciones.map((o) => (
          <View key={o.valor} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <Chip
              etiqueta={o.etiqueta}
              seleccionado={false}
              pista={o.etiqueta}
              alPresionar={() => turno.elegir(o.valor)}
              testID={`${testID}-opcion-${o.valor}`}
            />
          </View>
        ))}
      </View>
      <AccionTexto
        etiqueta={BTN_CORREGIR_OIDO}
        pista={PISTA_CORREGIR_OIDO}
        alPresionar={turno.corregir}
        testID={`${testID}-corregir`}
      />
    </Burbuja>
  );
}
