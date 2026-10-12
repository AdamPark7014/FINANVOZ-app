import { useState } from 'react';
import { View } from 'react-native';
import { detalleTanda, listarTandas, type DetalleTanda, type RondaTandaVista } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { Seccion } from '../tarjetas/componentes';
import { MeTocoLaTanda, useYaLaDi } from './componentes';
import { textoAportado, textoEnRiesgo, textoPorAportar, TEXTO_NO_ES_INGRESO } from './textos';

const ESTADO_RONDA: Record<NonNullable<RondaTandaVista['estado']>, string> = {
  pendiente: 'Por dar',
  cubierta: 'Ya la diste',
  omitida: 'Ya la habías dado',
};

/**
 * Detalle de una tanda (`02 §18`): calendario de rondas con la tuya marcada (E11), "Llevas $1,500 aportados",
 * "Si la tanda se cae, arriesgas $1,500" (`en_riesgo`) y, después de cobrar, "Te faltan $3,000 por aportar".
 * "Ya la di" registra la próxima aportación; "Me tocó la tanda", el cobro (no es ingreso).
 */
export function PantallaTanda({ tandaId, alVolver }: { tandaId: string; alVolver: () => void }) {
  const existe = useVista((ctx) => listarTandas(ctx).some((t) => t.id === tandaId));
  if (!existe) {
    return (
      <Pantalla testID="pantalla-tanda" bordes={['top', 'left', 'right', 'bottom']}>
        <Boton etiqueta="Volver" variante="texto" ancho="contenido" alPresionar={alVolver} />
        <Texto variante="cuerpo">No encontré esa tanda.</Texto>
      </Pantalla>
    );
  }
  return <Detalle tandaId={tandaId} alVolver={alVolver} />;
}

function Detalle({ tandaId, alVolver }: { tandaId: string; alVolver: () => void }) {
  const d = useVista((ctx) => detalleTanda(ctx, tandaId));
  const [cobrando, setCobrando] = useState(false);
  const ya = useYaLaDi(tandaId, d.proxima?.fecha ?? null, 'tanda-ya-la-di');
  return (
    <Pantalla testID="pantalla-tanda" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="tanda-volver"
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <View style={{ gap: espacio.xxs }}>
        <Texto variante="titulo" testID="tanda-titulo">
          {d.nombre}
        </Texto>
        <Texto variante="secundario" tono="secundario">
          {`${formatearCentavos(d.aportacion)} por ronda · ${d.participantes} participantes · tu turno: ${d.turno}`}
        </Texto>
      </View>

      <Resumen d={d} />

      {d.proxima ? (
        <Tarjeta>
          <Texto variante="cuerpo">{`Próxima aportación: ${d.proxima.etiqueta}`}</Texto>
          {ya.elegir ?? <Boton testID="tanda-ya-la-di" etiqueta="Ya la di" alPresionar={() => ya.dar()} />}
          {ya.error ? (
            <Texto variante="secundario" tono="faltante">
              {ya.error}
            </Texto>
          ) : null}
        </Tarjeta>
      ) : null}

      {!d.cobrada ? (
        <Tarjeta>
          <Texto variante="cuerpo">{`Cobras ${formatearCentavos(d.cobro)} el ${d.etiquetaCobro}.`}</Texto>
          {cobrando ? (
            <MeTocoLaTanda tandaId={tandaId} testID="tanda-me-toco" alTerminar={() => setCobrando(false)} />
          ) : (
            <Boton
              testID="tanda-me-toco"
              etiqueta="Me tocó la tanda"
              variante="secundario"
              alPresionar={() => setCobrando(true)}
            />
          )}
          <Texto variante="secundario" tono="secundario">
            {TEXTO_NO_ES_INGRESO}
          </Texto>
        </Tarjeta>
      ) : null}

      <Seccion titulo="Calendario" testID="tanda-calendario">
        {d.rondas.map((r) => (
          <Tarjeta key={r.t} testID={`tanda-ronda-${r.t}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
              <Texto variante={r.esCobro ? 'cuerpoFuerte' : 'cuerpo'} style={{ flex: 1 }}>
                {`${r.t}. ${r.etiqueta}${r.esCobro ? ' · tu turno' : ''}`}
              </Texto>
              <Texto variante="secundario" tono="secundario">
                {r.estado ? ESTADO_RONDA[r.estado] : 'Más adelante'}
              </Texto>
            </View>
            <Texto variante="secundario" tono="secundario" testID={`tanda-ronda-${r.t}-riesgo`}>
              {`Después de esta ronda arriesgas ${formatearCentavos(r.enRiesgo)}`}
            </Texto>
          </Tarjeta>
        ))}
      </Seccion>
    </Pantalla>
  );
}

function Resumen({ d }: { d: DetalleTanda }) {
  return (
    <Tarjeta testID="tanda-resumen-detalle">
      <Texto variante="cuerpo" testID="tanda-aportado">
        {textoAportado(d.aportado)}
      </Texto>
      <Texto variante="cuerpoFuerte" testID="tanda-en-riesgo">
        {textoEnRiesgo(d.enRiesgo)}
      </Texto>
      {d.cobrada ? (
        <Texto variante="cuerpo" testID="tanda-por-aportar">
          {textoPorAportar(d.porAportar)}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
