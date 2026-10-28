import { Pressable, Text } from 'react-native';
import type { VistaHoy } from '../../servicios';
import { FUENTE, cifraEnPalabras, espacio, formatearCentavos, margenPantalla, useTema } from '../../ui';
import { PISTA_OCULTAR_DESGLOSE, PISTA_VER_DESGLOSE, PISTA_VER_QUE_VIENE } from '../principal/textos';
import { etiquetaPildoraDia, textoPildoraDia } from './textos';

/**
 * La cifra del día mientras hay conversación (tablero B2): una píldora arriba con «Hoy puedes gastar · hasta el vie
 * 30» y la cifra. Tocarla abre y cierra el mismo desglose que «Cómo lo calculé» (`boton-desglose`).
 */
export function PildoraDia({
  vista,
  abierto,
  alPresionar,
}: {
  vista: VistaHoy;
  abierto: boolean;
  alPresionar: () => void;
}) {
  const { c } = useTema();
  const negativo = vista.estado === 'libre_negativo';
  const cifra = negativo ? 0 : vista.hoyPuedesCentavos;
  const texto = textoPildoraDia(vista);
  return (
    <Pressable
      testID="boton-desglose"
      onPress={alPresionar}
      accessibilityRole="button"
      accessibilityLabel={etiquetaPildoraDia(texto, cifraEnPalabras(cifra, 'pesos'))}
      accessibilityHint={
        abierto ? PISTA_OCULTAR_DESGLOSE : negativo ? PISTA_VER_QUE_VIENE : PISTA_VER_DESGLOSE
      }
      accessibilityState={{ expanded: abierto }}
      style={({ pressed }) => ({
        marginHorizontal: margenPantalla,
        minHeight: 52,
        borderRadius: 26,
        backgroundColor: c.superficie,
        borderWidth: 1,
        borderColor: abierto ? c.acento : c.borde,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: espacio.m,
        paddingHorizontal: 18,
        paddingVertical: espacio.xs,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        importantForAccessibility="no"
        style={{
          fontFamily: FUENTE,
          flexShrink: 1,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: '600',
          color: c.textoSecundario,
        }}
      >
        {texto}
      </Text>
      <Text
        testID="hoy-puedes"
        importantForAccessibility="no"
        style={{
          fontFamily: FUENTE,
          fontSize: 22,
          lineHeight: 28,
          fontWeight: '800',
          color: negativo ? c.faltante : c.acentoTexto,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatearCentavos(cifra, 'pesos')}
      </Text>
    </Pressable>
  );
}
