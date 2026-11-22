import { diaSemana, partes } from '@cartera/core';
import { Text, View } from 'react-native';
import { FUENTE, useTema } from '../../ui';

const DIAS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] as const;
export const LADO_CUADRO_FECHA = 44;

/**
 * El día en un cuadro («MIÉ 28»), como en «Lo que viene» (D6): la fecha se lee de un vistazo en las listas de pagos.
 * Decorativo: la fila dice la fecha completa en su etiqueta.
 */
export function CuadroFecha({ fecha }: { fecha: string }) {
  const { c } = useTema();
  const f = fecha as Parameters<typeof partes>[0];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: LADO_CUADRO_FECHA,
        height: LADO_CUADRO_FECHA,
        borderRadius: 12,
        backgroundColor: c.superficieAlterna,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: FUENTE,
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '700',
          color: c.textoSecundario,
        }}
      >
        {DIAS[diaSemana(f) - 1]}
      </Text>
      <Text style={{ fontFamily: FUENTE, fontSize: 17, lineHeight: 20, fontWeight: '800', color: c.texto }}>
        {partes(f).dia}
      </Text>
    </View>
  );
}
