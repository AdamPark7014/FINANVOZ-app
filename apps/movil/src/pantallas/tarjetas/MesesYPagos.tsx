import type { Centavos, Regla } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  agregarPagoPlaneado,
  etiquetaDiaMes,
  liquidarMsi,
  quitarPagoPlaneado,
  sugerenciaAvalancha,
  type DetalleTarjeta,
  type MesCompromiso,
  type PagoPlaneadoVista,
  type PlanMsiVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Barra,
  Boton,
  CampoMonto,
  CampoTexto,
  Cifra,
  espacio,
  formatearCentavos,
  Tarjeta,
  Texto,
} from '../../ui';
import { Chips } from '../onboarding/componentes';
import { leerDiaMes } from '../onboarding/ingreso';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { ElegirCuenta, Seccion } from './componentes';
import {
  etiquetaMes,
  mensajeLiquidacionPlan,
  NOMBRE_ESTADO_PLAN,
  SUBTITULO_COMPROMISO_MSI,
  subtituloPagosPlaneados,
  TITULO_COMPROMISO_MSI,
  TITULO_MESES_SIN_INTERESES,
  TITULO_PAGOS_PLANEADOS,
  BTN_CANCELAR,
  BTN_GUARDAR_PAGO_PLANEADO,
  BTN_LIQUIDAR_MESES,
  BTN_SI_LIQUIDAR,
  ERROR_DIA_PAGO_PLANEADO,
  ERROR_MONTO_PAGO_PLANEADO,
  textoConfirmarLiquidar,
  VACIO_MSI_TARJETA,
} from './textos';

// ——— Meses sin intereses ———

/** Un plan: cuota, cuotas restantes, mes en que termina y "Liquidar" (`02 §8`). */
function FilaPlan({ p }: { p: PlanMsiVista }) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activo = p.estado === 'activo' && p.restante > 0;
  return (
    <Tarjeta testID={`plan-${p.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
          {p.descripcion}
        </Texto>
        <Cifra centavos={p.monto} contexto={p.descripcion} />
      </View>
      {activo ? (
        <>
          <Texto variante="secundario" testID={`plan-${p.id}-cuotas`}>
            {`${formatearCentavos(p.cuota)} al mes · faltan ${p.cuotasRestantes} de ${p.meses}`}
          </Texto>
          {p.terminaEn ? (
            <Texto variante="secundario" tono="secundario">
              {`Terminas en ${etiquetaMes(p.terminaEn)}`}
            </Texto>
          ) : null}
          <Texto variante="secundario" tono="secundario">
            {`Te falta ${formatearCentavos(p.restante)}`}
          </Texto>
        </>
      ) : (
        <Texto variante="secundario" tono="secundario" testID={`plan-${p.id}-estado`}>
          {NOMBRE_ESTADO_PLAN[p.estado]}
        </Texto>
      )}
      {activo && confirmando ? (
        <View style={{ gap: espacio.s }}>
          <Texto variante="cuerpo">
            {textoConfirmarLiquidar(p.descripcion, formatearCentavos(p.restante))}
          </Texto>
          <Boton
            etiqueta={BTN_SI_LIQUIDAR}
            testID={`plan-${p.id}-confirmar-liquidar`}
            alPresionar={() => {
              try {
                const l = liquidarMsi(ctx, p.id);
                avisarRegistro(
                  mensajeLiquidacionPlan(p.descripcion, formatearCentavos(l.monto)),
                  l.deshacer,
                );
              } catch (e) {
                setError(mensajeError(e));
              }
            }}
          />
          <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={() => setConfirmando(false)} />
        </View>
      ) : null}
      {activo && !confirmando ? (
        <Boton
          etiqueta={BTN_LIQUIDAR_MESES}
          variante="secundario"
          ancho="contenido"
          testID={`plan-${p.id}-liquidar`}
          alPresionar={() => setConfirmando(true)}
        />
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

export function SeccionMeses({ planes }: { planes: readonly PlanMsiVista[] }) {
  return (
    <Seccion titulo={TITULO_MESES_SIN_INTERESES} testID="tarjeta-meses">
      {planes.length === 0 ? (
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="tarjeta-meses-vacio"
          accessibilityLiveRegion="polite"
        >
          {VACIO_MSI_TARJETA}
        </Texto>
      ) : null}
      {planes.map((p) => (
        <FilaPlan key={p.id} p={p} />
      ))}
    </Seccion>
  );
}

/** Compromiso de meses de los próximos 12 meses (`02 §8`): una barra por mes, siempre con su cifra. */
export function CompromisoMeses({ meses }: { meses: readonly MesCompromiso[] }) {
  if (!meses.some((m) => m.monto > 0)) return null;
  const mayor = Math.max(...meses.map((m) => m.monto));
  return (
    <Seccion
      titulo={TITULO_COMPROMISO_MSI}
      subtitulo={SUBTITULO_COMPROMISO_MSI}
      testID="compromiso-12-meses"
    >
      {meses.map((m) => {
        const etiqueta = etiquetaMes(m.mes);
        return (
          <View key={m.mes} testID={`compromiso-${m.mes}`} style={{ gap: espacio.xxs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
              <Texto variante="secundario" style={{ flex: 1 }}>
                {etiqueta}
              </Texto>
              <Cifra
                centavos={m.monto}
                tamano="secundario"
                contexto={`Meses en ${etiqueta}`}
                testID={`compromiso-${m.mes}-monto`}
              />
            </View>
            <Barra
              llenoBp={mayor > 0 ? Math.round((m.monto * 10000) / mayor) : 0}
              etiquetaAccesible={`${etiqueta}: ${formatearCentavos(m.monto)}`}
              alto={8}
            />
          </View>
        );
      })}
    </Seccion>
  );
}

// ——— Pagos planeados (modo plan, RF-TAR-06) ———

type Frecuencia = 'quincena' | 'mensual';

const OPCIONES_FRECUENCIA: readonly { valor: Frecuencia; etiqueta: string }[] = [
  { valor: 'quincena', etiqueta: 'Cada quincena (15 y último)' },
  { valor: 'mensual', etiqueta: 'Cada mes' },
];

function descripcionRegla(r: Regla): string {
  switch (r.tipo) {
    case 'quincenal_15_ultimo':
      return 'Cada quincena';
    case 'quincenal_dias':
      return `Los días ${r.dias[0]} y ${r.dias[1]}`;
    case 'mensual':
      return `Cada mes, el ${r.dia}`;
    case 'semanal':
      return 'Cada semana';
    case 'catorcenal':
      return 'Cada 14 días';
    case 'anual':
      return 'Cada año';
    case 'unica':
      return `Una vez, el ${etiquetaDiaMes(r.fecha)}`;
  }
}

function FilaPagoPlaneado({ p }: { p: PagoPlaneadoVista }) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const proxima = p.proximas[0];
  return (
    <Tarjeta testID={`pago-planeado-${p.programadoId}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
          {descripcionRegla(p.regla)}
        </Texto>
        <Cifra centavos={p.monto} contexto={p.concepto} />
      </View>
      {proxima ? (
        <Texto variante="secundario" tono="secundario">
          {`El próximo es el ${etiquetaDiaMes(proxima)}`}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Quitar"
        variante="texto"
        ancho="contenido"
        testID={`pago-planeado-${p.programadoId}-quitar`}
        alPresionar={() => {
          try {
            quitarPagoPlaneado(ctx, p.programadoId);
            refrescar();
            mostrar({ mensaje: 'Quité ese pago. Ahora aparto lo que debes completo.' });
          } catch (e) {
            mostrar({ mensaje: mensajeError(e) });
          }
        }}
      />
    </Tarjeta>
  );
}

function AgregarPagoPlaneado({ tarjetaId, alTerminar }: { tarjetaId: string; alTerminar: () => void }) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('quincena');
  const [dia, setDia] = useState('');
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (monto === null || monto <= 0) return setError(ERROR_MONTO_PAGO_PLANEADO);
    let regla: Regla = { tipo: 'quincenal_15_ultimo' };
    if (frecuencia === 'mensual') {
      const d = leerDiaMes(dia);
      if (d === null) return setError(ERROR_DIA_PAGO_PLANEADO);
      regla = { tipo: 'mensual', dia: d };
    }
    try {
      agregarPagoPlaneado(ctx, { tarjetaId, monto, regla, cuentaId: cuenta });
      refrescar();
      mostrar({ mensaje: `Listo: aparto ${formatearCentavos(monto)} para cada pago planeado.` });
      alTerminar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <View style={{ gap: espacio.m }} testID="agregar-pago-planeado">
      <CampoMonto
        testID="pago-planeado-monto"
        etiqueta="¿Cuánto vas a pagar cada vez?"
        alCambiar={setMonto}
      />
      <Chips
        testID="pago-planeado-frecuencia"
        etiqueta="¿Cada cuándo?"
        opciones={OPCIONES_FRECUENCIA}
        valor={frecuencia}
        alCambiar={setFrecuencia}
      />
      {frecuencia === 'mensual' ? (
        <CampoTexto
          testID="pago-planeado-dia"
          etiqueta="Día del mes"
          ejemplo="5"
          teclado="number-pad"
          valor={dia}
          alCambiar={setDia}
        />
      ) : null}
      <ElegirCuenta
        pregunta="¿De qué cuenta sale? (opcional)"
        valor={cuenta}
        alElegir={(id) => setCuenta((c) => (c === id ? null : id))}
        prefijoTestID="pago-planeado-cuenta"
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={BTN_GUARDAR_PAGO_PLANEADO}
        alPresionar={guardar}
        testID="pago-planeado-guardar"
      />
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alTerminar} />
    </View>
  );
}

/**
 * Tarjetas que vas pagando por partes (RF-TAR-06): con pagos planeados solo aparto los que vencen antes de tu
 * próximo ingreso; sin ellos, lo que debes completo. Si hay varias, sugiere cuál pagar primero (la de tasa más
 * alta); no calcula intereses.
 */
export function PagosPlaneados({ d }: { d: DetalleTarjeta }) {
  const [agregando, setAgregando] = useState(false);
  const avalancha = useVista(sugerenciaAvalancha);
  const primera = avalancha[0];
  return (
    <Seccion
      titulo={TITULO_PAGOS_PLANEADOS}
      subtitulo={subtituloPagosPlaneados(d.pagosPlaneados.length > 0)}
      testID="tarjeta-pagos-planeados"
    >
      {d.pagosPlaneados.map((p) => (
        <FilaPagoPlaneado key={p.programadoId} p={p} />
      ))}
      {avalancha.length > 1 && primera && primera.tasaAnualBp !== null ? (
        <Texto variante="secundario" tono="secundario" testID="sugerencia-avalancha">
          {primera.tarjetaId === d.id
            ? 'Si puedes pagar de más, empieza por esta: es la de tasa más alta.'
            : `Si puedes pagar de más, empieza por tu ${primera.nombre}: es la de tasa más alta.`}
        </Texto>
      ) : null}
      {agregando ? (
        <AgregarPagoPlaneado tarjetaId={d.id} alTerminar={() => setAgregando(false)} />
      ) : (
        <Boton
          etiqueta="Agregar pago planeado"
          variante="secundario"
          testID="pago-planeado-agregar"
          alPresionar={() => setAgregando(true)}
        />
      )}
    </Seccion>
  );
}
