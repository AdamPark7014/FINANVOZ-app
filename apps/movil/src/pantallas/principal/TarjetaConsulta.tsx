import { View } from 'react-native';
import type { FiltroMovimientos, RespuestaConsulta } from '../../servicios';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { Boton, espacio, Tarjeta, Texto } from '../../ui';
import { BTN_LISTO, BTN_VER_MOVIMIENTOS, BTN_VER_PLUS } from './textos';

/**
 * Respuesta de una consulta tipada (`06 §6`, RF-CON-01): la frase de la plantilla, las filas (pagos, top de
 * gastos, cuentas) y "Ver movimientos", que abre Movimientos con el filtro de la consulta. Las cifras ya vienen
 * calculadas por servicios.
 */
export function TarjetaConsulta({
  respuesta,
  alVerMovimientos,
  alCerrar,
}: {
  respuesta: RespuestaConsulta;
  alVerMovimientos?: (filtro: FiltroMovimientos) => void;
  alCerrar: () => void;
}) {
  const { abrirPlan } = usePlanTienda();
  return (
    <Tarjeta testID="respuesta-consulta">
      <Texto variante="cuerpo" accessibilityLiveRegion="polite" testID="respuesta-consulta-texto">
        {respuesta.texto}
      </Texto>
      {respuesta.lineas.length > 0 ? (
        <View style={{ gap: espacio.xs }} testID="respuesta-consulta-lineas">
          {respuesta.lineas.map((l, i) => (
            <View
              key={`${i}-${l.etiqueta}`}
              accessible
              accessibilityLabel={`${l.etiqueta}: ${l.valor}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
            >
              <Texto variante="secundario" tono="secundario" style={{ flexShrink: 1 }}>
                {l.etiqueta}
              </Texto>
              <Texto variante="secundario">{l.valor}</Texto>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {respuesta.soloPlus ? (
          abrirPlan ? (
            <Boton
              etiqueta="Ver Plus"
              variante="secundario"
              ancho="contenido"
              alPresionar={abrirPlan}
              testID="boton-ver-plus-consulta"
            />
          ) : null
        ) : alVerMovimientos ? (
          <Boton
            etiqueta="Ver movimientos"
            variante="secundario"
            ancho="contenido"
            alPresionar={() => alVerMovimientos(respuesta.filtro)}
            testID="boton-ver-movimientos-consulta"
          />
        ) : null}
        <Boton etiqueta="Listo" variante="texto" ancho="contenido" alPresionar={alCerrar} />
      </View>
    </Tarjeta>
  );
}
