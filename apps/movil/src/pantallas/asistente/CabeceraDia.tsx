import { View } from 'react-native';
import { etiquetaDiaMes, etiquetaFecha, type VistaHoy } from '../../servicios';
import { Boton, Cifra, espacio, formatearCentavos, Texto } from '../../ui';
import { OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import {
  BTN_CONFIGURAR_INGRESO_HOY,
  CONTEXTO_CIFRA_HOY_PUEDES,
  CONTEXTO_CIFRA_LIBRE_NEGATIVO,
  encabezadoFecha,
  PISTA_CONFIGURAR_INGRESO_HOY,
  SUBTITULO_SIN_INGRESO,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
  TITULO_SIN_INGRESO,
} from '../principal/textos';
import { BarraDia } from './BarraDia';

/**
 * Cabecera compacta del asistente (maqueta Hoy A, ≤ 112 pt): «Hoy puedes gastar $214» a la izquierda, la fecha y
 * los días al ingreso a la derecha, y la barra reservado · colchón · libre que abre el desglose.
 */
export function CabeceraDia({
  vista,
  desgloseAbierto,
  alAlternarDesglose,
  alConfigurarIngreso,
}: {
  vista: VistaHoy;
  desgloseAbierto: boolean;
  alAlternarDesglose: () => void;
  alConfigurarIngreso: () => void;
}) {
  const fecha = encabezadoFecha(etiquetaFecha(vista.hoy), etiquetaDiaMes(vista.hoy));
  if (vista.estado === 'sin_ingreso') {
    return (
      <View style={{ gap: espacio.xs }} testID="hoy-sin-ingreso">
        <Texto variante="secundario" tono="secundario" testID="hoy-fecha">
          {fecha}
        </Texto>
        <Texto variante="subtitulo" testID="hoy-sin-ingreso-titulo">
          {vista.mensaje ?? TITULO_SIN_INGRESO}
        </Texto>
        <Texto variante="secundario" tono="secundario" testID="hoy-sin-ingreso-subtitulo">
          {SUBTITULO_SIN_INGRESO}
        </Texto>
        <Boton
          etiqueta={BTN_CONFIGURAR_INGRESO_HOY}
          variante="secundario"
          alPresionar={alConfigurarIngreso}
          pista={PISTA_CONFIGURAR_INGRESO_HOY}
          testID="boton-configurar-ingreso"
        />
      </View>
    );
  }
  const negativo = vista.estado === 'libre_negativo';
  const cuando = vista.proximoIngreso ? `antes del ${vista.proximoIngreso.etiqueta}` : 'en los próximos días';
  const secundario = negativo
    ? `Te faltan ${formatearCentavos(vista.faltante)} para cubrir lo que viene ${cuando}.`
    : (vista.textoDias ?? vista.mensaje);
  return (
    <View style={{ gap: espacio.m }} testID="cabecera-dia">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.m }}>
        <View style={{ flexShrink: 0, gap: espacio.xxs }}>
          <Texto
            variante="etiqueta"
            tono="secundario"
            testID={negativo ? 'hoy-libre-negativo-etiqueta' : 'hoy-puedes-etiqueta'}
            {...OCULTAR_ETIQUETA_VISIBLE}
          >
            {negativo ? TITULO_HOY_LIBRE_NEGATIVO : TITULO_HOY_PUEDES_GASTAR}
          </Texto>
          <Cifra
            centavos={negativo ? 0 : vista.hoyPuedesCentavos}
            modo="pesos"
            tamano="grande"
            contexto={negativo ? CONTEXTO_CIFRA_LIBRE_NEGATIVO : CONTEXTO_CIFRA_HOY_PUEDES}
            testID="hoy-puedes"
          />
        </View>
        <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
          <Texto variante="secundario" tono="secundario" alinear="right" testID="hoy-fecha">
            {fecha}
          </Texto>
          {secundario ? (
            <Texto
              variante="secundario"
              tono={negativo ? 'faltante' : 'secundario'}
              alinear="right"
              testID="hoy-secundario"
            >
              {secundario}
            </Texto>
          ) : null}
        </View>
      </View>
      <BarraDia vista={vista} expandido={desgloseAbierto} alPresionar={alAlternarDesglose} />
    </View>
  );
}
