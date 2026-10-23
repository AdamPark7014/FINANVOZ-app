import { ScrollView, useWindowDimensions } from 'react-native';
import type { OpcionesBloques, VistaHoy } from '../../servicios';
import { Boton, espacio } from '../../ui';
import { CandadoPlus } from '../plan/CandadoPlus';
import { ProbabilidadHoy } from '../principal/ProbabilidadHoy';
import { PISTA_ME_ALCANZA_HOY } from '../principal/textos';
import { Desglose } from './Desglose';
import { BTN_ME_ALCANZA } from './textos';

/** El panel ocupa como máximo esta fracción de la pantalla; la conversación sigue a la vista debajo. */
const ALTO_MAX = 0.5;

/**
 * Lo que abre la barra del día: la probabilidad de llegar (Plus; en Gratis, el candado si hay plan que abrir), el
 * desglose completo y «¿Me alcanza?». Se desplaza solo si no cabe.
 */
export function PanelDesglose({
  vista,
  probabilidad,
  conCandado,
  bloques,
  alMeAlcanza,
}: {
  vista: VistaHoy;
  /** Plus: muestra la barra de probabilidad. */
  probabilidad: boolean;
  /** Gratis con tienda: candado «Ver probabilidad». */
  conCandado: boolean;
  bloques?: Omit<OpcionesBloques, 'senal'>;
  alMeAlcanza?: () => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <ScrollView
      style={{ maxHeight: height * ALTO_MAX }}
      contentContainerStyle={{ gap: espacio.m, paddingBottom: espacio.s }}
      keyboardShouldPersistTaps="handled"
      testID="panel-desglose"
    >
      {probabilidad ? (
        <ProbabilidadHoy {...(bloques ? { bloques } : {})} />
      ) : conCandado ? (
        <CandadoPlus texto="Ver probabilidad" testID="candado-probabilidad" />
      ) : null}
      <Desglose vista={vista} />
      {alMeAlcanza ? (
        <Boton
          etiqueta={BTN_ME_ALCANZA}
          variante="secundario"
          pista={PISTA_ME_ALCANZA_HOY}
          alPresionar={alMeAlcanza}
          testID="boton-me-alcanza"
        />
      ) : null}
    </ScrollView>
  );
}
