import { useState } from 'react';
import { View } from 'react-native';
import { todaviaNo, todaviaNoCobroTanda, type TarjetaTanda } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { MeTocoLaTanda, useYaLaDi } from './componentes';
import {
  ETIQUETA_ME_TOCO,
  ETIQUETA_TODAVIA_NO,
  ETIQUETA_YA_LA_DI,
  MENSAJE_TODAVIA_NO_APORTACION,
  MENSAJE_TODAVIA_NO_COBRO,
  TEXTO_NO_ES_INGRESO,
} from './textos';

/** Tarjetas de Hoy de la tanda (`02 §18`): "¿Ya diste tu tanda?" y "Me tocó la tanda". */
export function TarjetaDeTanda({ t, testID }: { t: TarjetaTanda; testID: string }) {
  return t.tipo === 'tanda_aportacion' ? (
    <TarjetaAportacion t={t} testID={testID} />
  ) : (
    <TarjetaCobro t={t} testID={testID} />
  );
}

function TarjetaAportacion({
  t,
  testID,
}: {
  t: Extract<TarjetaTanda, { tipo: 'tanda_aportacion' }>;
  testID: string;
}) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const ya = useYaLaDi(t.tandaId, t.fecha, testID);
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{t.pregunta}</Texto>
      <Texto variante="secundario" tono="secundario">
        {`${t.nombre} · ${formatearCentavos(t.monto)}${t.cuando === 'hoy' ? ' hoy' : `, tocaba el ${t.etiquetaFecha}`}`}
      </Texto>
      {ya.elegir ?? (
        <View style={{ gap: espacio.s }}>
          <Boton etiqueta={ETIQUETA_YA_LA_DI} alPresionar={() => ya.dar()} testID={`${testID}-ya-la-di`} />
          <Boton
            etiqueta={ETIQUETA_TODAVIA_NO}
            variante="secundario"
            testID={`${testID}-todavia-no`}
            alPresionar={() => {
              todaviaNo(ctx, { programadoId: t.programadoId, fecha: t.fecha });
              refrescar();
              mostrar({ mensaje: MENSAJE_TODAVIA_NO_APORTACION });
            }}
          />
        </View>
      )}
      {ya.error ? (
        <Texto variante="secundario" tono="faltante">
          {ya.error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

function TarjetaCobro({ t, testID }: { t: Extract<TarjetaTanda, { tipo: 'tanda_cobro' }>; testID: string }) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [cobrando, setCobrando] = useState(false);
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{t.pregunta}</Texto>
      <Texto variante="secundario" tono="secundario">
        {`${t.nombre} · ${formatearCentavos(t.monto)}. ${TEXTO_NO_ES_INGRESO}`}
      </Texto>
      {cobrando ? (
        <MeTocoLaTanda
          tandaId={t.tandaId}
          testID={`${testID}-me-toco`}
          alTerminar={() => setCobrando(false)}
        />
      ) : (
        <View style={{ gap: espacio.s }}>
          <Boton
            etiqueta={ETIQUETA_ME_TOCO}
            alPresionar={() => setCobrando(true)}
            testID={`${testID}-me-toco`}
          />
          <Boton
            etiqueta={ETIQUETA_TODAVIA_NO}
            variante="secundario"
            testID={`${testID}-todavia-no`}
            alPresionar={() => {
              todaviaNoCobroTanda(ctx, t.tandaId);
              refrescar();
              mostrar({ mensaje: MENSAJE_TODAVIA_NO_COBRO });
            }}
          />
        </View>
      )}
    </Tarjeta>
  );
}
