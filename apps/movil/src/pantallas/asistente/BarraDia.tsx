import { Pressable, View } from 'react-native';
import type { VistaHoy } from '../../servicios';
import { espacio, formatearCentavos, radio, Texto, useTema } from '../../ui';
import { PISTA_OCULTAR_DESGLOSE, PISTA_VER_DESGLOSE, PISTA_VER_QUE_VIENE } from '../principal/textos';
import { etiquetaBarraDia, LEYENDA_COLCHON, LEYENDA_LIBRE, LEYENDA_RESERVADO } from './textos';

/** Alto de la línea (8 pt): sigue siendo una línea con leyenda, no una gráfica (decisión 6). */
const ALTO_LINEA = 8;
/** Amplía el toque a 48 sin hacer la cabecera más alta. */
const AMPLIAR_TOQUE = { top: 12, bottom: 12, left: 0, right: 0 } as const;

/** Partes de la barra en puntos base (suman 10,000); sin dinero, todo en cero. */
export function partesBarra(reservado: number, colchon: number, libre: number): [number, number, number] {
  const r = Math.max(0, reservado);
  const c = Math.max(0, colchon);
  const l = Math.max(0, libre);
  const total = r + c + l;
  if (total === 0) return [0, 0, 0];
  const pr = Math.round((r * 10_000) / total);
  const pc = Math.round((c * 10_000) / total);
  return [pr, pc, 10_000 - pr - pc];
}

/**
 * Reservado · colchón · libre de `VistaHoy` (decisión 6 de Adam): una línea de 6 pt con leyenda. Tocarla abre el
 * desglose completo (`boton-desglose`, `desglose`). Los colores siempre van con texto: nada solo por color.
 */
export function BarraDia({
  vista,
  expandido,
  alPresionar,
}: {
  vista: VistaHoy;
  expandido: boolean;
  alPresionar: () => void;
}) {
  const { c } = useTema();
  const [pr, pc, pl] = partesBarra(vista.reservado, vista.colchon, vista.libre);
  const libre = Math.max(0, vista.libre);
  const segmentos = [
    { clave: 'reservado', partes: pr, color: c.textoSecundario },
    { clave: 'colchon', partes: pc, color: c.bordeControl },
    { clave: 'libre', partes: pl, color: c.acento },
  ];
  const leyenda = [
    {
      clave: 'reservado',
      etiqueta: `${LEYENDA_RESERVADO} ${formatearCentavos(vista.reservado)}`,
      color: c.textoSecundario,
    },
    {
      clave: 'colchon',
      etiqueta: `${LEYENDA_COLCHON} ${formatearCentavos(vista.colchon)}`,
      color: c.bordeControl,
    },
    { clave: 'libre', etiqueta: `${LEYENDA_LIBRE} ${formatearCentavos(libre)}`, color: c.acento },
  ];
  return (
    <Pressable
      testID="boton-desglose"
      onPress={alPresionar}
      hitSlop={AMPLIAR_TOQUE}
      accessibilityRole="button"
      accessibilityLabel={etiquetaBarraDia(vista.reservado, vista.colchon, libre)}
      accessibilityHint={
        expandido
          ? PISTA_OCULTAR_DESGLOSE
          : vista.estado === 'libre_negativo'
            ? PISTA_VER_QUE_VIENE
            : PISTA_VER_DESGLOSE
      }
      accessibilityState={{ expanded: expandido }}
      style={({ pressed }) => ({
        gap: espacio.s,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        testID="barra-dia"
        style={{
          flexDirection: 'row',
          height: ALTO_LINEA,
          borderRadius: radio.pastilla,
          overflow: 'hidden',
          backgroundColor: c.superficieAlterna,
        }}
      >
        {segmentos.map((s) =>
          s.partes > 0 ? (
            <View
              key={s.clave}
              testID={`barra-dia-${s.clave}`}
              style={{ flexGrow: s.partes, flexBasis: 0, backgroundColor: s.color }}
            />
          ) : null,
        )}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {leyenda.map((l) => (
          <View key={l.clave} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color }} />
            <Texto variante="pequeno" tono="secundario" testID={`leyenda-${l.clave}`}>
              {l.etiqueta}
            </Texto>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
