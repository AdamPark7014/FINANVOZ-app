import { UMBRAL_USO_BP } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  detalleTarjeta,
  etiquetaDiaMes,
  funcionesPlan,
  listarTarjetas,
  type DetalleTarjeta,
  type EstadoCuentaVista,
  type PreguntaLiquidar,
} from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { Barra, Boton, Cifra, espacio, formatearCentavos, Pantalla, Tarjeta, Texto } from '../../ui';
import { CandadoPlus } from '../plan/CandadoPlus';
import { NOMBRE_TIPO_LIBRO } from '../principal/textos';
import { Dato, FormularioPago, PreguntaLiquidarMeses, Seccion } from './componentes';
import { CorregirSaldo, EditarTarjeta } from './EditarTarjeta';
import { CompromisoMeses, PagosPlaneados, SeccionMeses } from './MesesYPagos';
import { NOMBRE_MODO } from './textos';

type Panel = 'pagar' | 'editar' | 'corregir' | null;

/**
 * Detalle de una tarjeta (`02 §8`): cuánto debes, pago para no generar intereses, fecha límite, próximo corte,
 * uso del límite con el 30 % marcado, saldo a favor (nunca como dinero para gastar), meses sin intereses con su
 * compromiso de 12 meses, compras desde el corte, estados de cuenta, pagos planeados y configuración.
 */
export function PantallaTarjeta({ tarjetaId, alVolver }: { tarjetaId: string; alVolver: () => void }) {
  // Si la tarjeta deja de existir (p. ej. tras borrar todo), se vuelve.
  const existe = useVista((ctx) => listarTarjetas(ctx).some((t) => t.id === tarjetaId));
  if (!existe) {
    return (
      <Pantalla testID="pantalla-tarjeta" bordes={['top', 'left', 'right', 'bottom']}>
        <Boton etiqueta="Volver" variante="texto" ancho="contenido" alPresionar={alVolver} />
        <Texto variante="cuerpo">No encontré esa tarjeta.</Texto>
      </Pantalla>
    );
  }
  return <Detalle tarjetaId={tarjetaId} alVolver={alVolver} />;
}

function Detalle({ tarjetaId, alVolver }: { tarjetaId: string; alVolver: () => void }) {
  const d = useVista((ctx) => detalleTarjeta(ctx, tarjetaId));
  const plus = useVista(funcionesPlan);
  const [panel, setPanel] = useState<Panel>(null);
  const [pregunta, setPregunta] = useState<PreguntaLiquidar | null>(null);

  return (
    <Pantalla testID="pantalla-tarjeta" bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        testID="tarjeta-volver"
        etiqueta="Volver"
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
      />
      <View style={{ gap: espacio.xxs }}>
        <Texto variante="titulo" testID="tarjeta-nombre">
          {d.nombre}
        </Texto>
        <Texto variante="secundario" tono="secundario">
          {NOMBRE_MODO[d.modo]}
        </Texto>
      </View>

      <Resumen d={d} />

      {pregunta && d.saldoAFavor > 0 && d.planes.some((p) => p.estado === 'activo') ? (
        <PreguntaLiquidarMeses
          pregunta={pregunta}
          testID="tarjeta-pregunta-liquidar"
          alTerminar={() => setPregunta(null)}
        />
      ) : null}

      {panel === 'pagar' ? (
        <Tarjeta>
          <Texto variante="subtitulo">Pagar tarjeta</Texto>
          <FormularioPago
            tarjetaId={d.id}
            nombre={d.nombre}
            montoSugerido={d.pngi > 0 ? d.pngi : Math.max(0, d.saldoRevolvente)}
            alTerminar={(r) => {
              setPanel(null);
              setPregunta(r.preguntaLiquidar);
            }}
            alCancelar={() => setPanel(null)}
          />
        </Tarjeta>
      ) : (
        <Boton etiqueta="Pagar" alPresionar={() => setPanel('pagar')} testID="tarjeta-pagar" />
      )}

      <SeccionMeses planes={d.planes} />
      {/* Plus (`02 §8`): en Gratis los meses siguen en "Meses sin intereses"; solo se oculta el calendario. */}
      {plus.compromisoMsi12Meses ? (
        <CompromisoMeses meses={d.compromiso12Meses} />
      ) : d.compromiso12Meses.some((m) => m.monto > 0) ? (
        <CandadoPlus texto="Ver tus meses de los próximos 12 meses" testID="candado-compromiso-12-meses" />
      ) : null}

      {d.modo === 'plan' ? <PagosPlaneados d={d} /> : null}

      <Seccion
        titulo={d.ultimoCorte ? 'Desde tu último corte' : 'Desde que la agregaste'}
        testID="tarjeta-movimientos"
      >
        {d.desdeElCorte.length === 0 ? (
          <Texto variante="secundario" tono="secundario">
            Sin compras ni pagos todavía.
          </Texto>
        ) : null}
        {d.desdeElCorte.map((m) => {
          const titulo =
            m.descripcion ?? m.comercio ?? m.categoria ?? NOMBRE_TIPO_LIBRO[m.tipo] ?? 'Movimiento';
          return (
            <View
              key={m.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
            >
              <Texto variante="secundario" style={{ flex: 1 }}>
                {`${titulo} · ${etiquetaDiaMes(m.fecha)}`}
              </Texto>
              <Cifra
                centavos={m.sentido === 'salida' ? -m.monto : m.monto}
                tamano="secundario"
                contexto={titulo}
              />
            </View>
          );
        })}
      </Seccion>

      <Seccion titulo="Estados de cuenta" testID="tarjeta-estados">
        {d.estadosCuenta.length === 0 ? (
          <Texto variante="secundario" tono="secundario">
            {`Tu primer corte con la app es el ${d.etiquetaProximoCorte}.`}
          </Texto>
        ) : null}
        {d.estadosCuenta.map((e) => (
          <EstadoCuenta key={e.corte} e={e} />
        ))}
      </Seccion>

      <Seccion titulo="Configuración" testID="tarjeta-configuracion">
        {panel === 'editar' ? (
          <EditarTarjeta d={d} alTerminar={() => setPanel(null)} />
        ) : panel === 'corregir' ? (
          <CorregirSaldo d={d} alTerminar={() => setPanel(null)} />
        ) : (
          <>
            <Texto variante="secundario" tono="secundario">
              {d.ciclo.diaLimitePago !== undefined
                ? `Corta el ${d.ciclo.diaCorte} y pagas el ${d.ciclo.diaLimitePago}.`
                : `Corta el ${d.ciclo.diaCorte} y tienes ${d.ciclo.diasParaPagar ?? 0} días para pagar.`}
            </Texto>
            <Boton
              etiqueta="Editar tarjeta"
              variante="secundario"
              alPresionar={() => setPanel('editar')}
              testID="tarjeta-editar"
            />
            <Boton
              etiqueta="Corregir saldo"
              variante="texto"
              alPresionar={() => setPanel('corregir')}
              testID="tarjeta-corregir"
            />
          </>
        )}
      </Seccion>
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

function Resumen({ d }: { d: DetalleTarjeta }) {
  return (
    <Tarjeta testID="tarjeta-resumen">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="subtitulo" style={{ flex: 1 }}>
          Debes
        </Texto>
        <Cifra
          centavos={d.deudaTotal}
          tamano="grande"
          contexto={`Debes en tu ${d.nombre}`}
          testID="tarjeta-deuda"
        />
      </View>
      {d.msiPorPagar > 0 ? (
        <Texto variante="secundario" tono="secundario" testID="tarjeta-deuda-meses">
          {`De eso, ${formatearCentavos(d.msiPorPagar)} son meses sin intereses.`}
        </Texto>
      ) : null}
      {d.saldoAFavor > 0 ? (
        <View testID="tarjeta-saldo-a-favor" style={{ gap: espacio.xxs }}>
          <Dato etiqueta="Saldo a favor" valor={formatearCentavos(d.saldoAFavor)} />
          <Texto variante="secundario" tono="secundario">
            No se suma a tu dinero libre: se usa en tus próximas compras con esta tarjeta.
          </Texto>
        </View>
      ) : null}
      {d.ultimoCorte ? (
        <View style={{ gap: espacio.xxs }}>
          <Dato
            etiqueta="Para no generar intereses"
            valor={formatearCentavos(d.pngi)}
            testID="tarjeta-pngi"
          />
          <Texto variante="secundario" tono="secundario">
            {d.pngi > 0
              ? `Págalo a más tardar el ${d.etiquetaFechaLimite}.`
              : 'Ya cubriste el pago de tu último corte.'}
          </Texto>
        </View>
      ) : (
        <Texto variante="secundario" tono="secundario" testID="tarjeta-sin-corte">
          {`Aún no cierra ningún corte desde que la agregaste. El primero es el ${d.etiquetaProximoCorte}.`}
        </Texto>
      )}
      <Dato etiqueta="Fecha límite" valor={d.etiquetaFechaLimite} testID="tarjeta-fecha-limite" />
      <Dato etiqueta="Próximo corte" valor={d.etiquetaProximoCorte} testID="tarjeta-proximo-corte" />
      <Dato etiqueta="Disponible" valor={formatearCentavos(d.disponible)} testID="tarjeta-disponible" />
      <Barra
        llenoBp={d.usoBp}
        marcaBp={UMBRAL_USO_BP}
        etiquetaAccesible={`Usas ${d.usoPorcentaje} % de tu límite`}
        testID="tarjeta-barra-uso"
      />
      <Texto variante="secundario" tono="secundario" testID="tarjeta-uso">
        {`Usas ${d.usoPorcentaje} % de tu límite de ${formatearCentavos(d.limiteCredito)}. La marca es el 30 %.`}
      </Texto>
    </Tarjeta>
  );
}

function EstadoCuenta({ e }: { e: EstadoCuentaVista }) {
  return (
    <Tarjeta testID={`estado-${e.corte}`}>
      <Texto variante="cuerpoFuerte">{`Corte del ${etiquetaDiaMes(e.corte)}`}</Texto>
      <Dato
        etiqueta={e.saldoCorte < 0 ? 'Saldo a favor al corte' : 'Debías al corte'}
        valor={formatearCentavos(Math.abs(e.saldoCorte))}
      />
      <Dato etiqueta="Pagaste después" valor={formatearCentavos(e.pagosPosteriores)} />
      <Dato etiqueta="Para no generar intereses" valor={formatearCentavos(e.pngi)} />
      <Texto variante="secundario" tono="secundario">
        {`Fecha límite: ${etiquetaDiaMes(e.limite)}`}
      </Texto>
    </Tarjeta>
  );
}
