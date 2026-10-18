import { useState } from 'react';
import { View } from 'react-native';
import {
  confirmarCobertura,
  confirmarIngresoRecibido,
  listarCuentas,
  omitirOcurrencia,
  rechazarCobertura,
  todaviaNo,
  todaviaNoPagoTarjeta,
  yaLaPague,
  type PreguntaLiquidar,
  type TarjetaAccion,
} from '../../servicios';
import { TarjetaPreguntaCaptura } from '../captura/PreguntasCaptura';
import { TarjetaArqueo, TarjetaCapturaInactiva, TarjetaReactivarCaptura } from '../captura/TarjetasCaptura';
import { FormularioPago, PreguntaLiquidarMeses } from '../tarjetas/componentes';
import { TarjetaDeTanda } from '../tandas/TarjetasTanda';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from './Chip';
import { useMostrarAviso } from './ProveedorAvisos';
import { codigoError, mensajeError } from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

type Compromiso = Extract<TarjetaAccion, { tipo: 'compromiso_vencido' }>;
type Ingreso = Extract<TarjetaAccion, { tipo: 'ingreso_no_llego' }>;
type PagoTarjeta = Extract<TarjetaAccion, { tipo: 'pago_tarjeta' }>;
type Cobertura = Extract<TarjetaAccion, { tipo: 'confirmar_cobertura' }>;

/** Tarjetas de acción de Hoy (02-UX §4.1); el servicio ya las ordena y limita a dos. */
export function TarjetasAccion({
  tarjetas,
  alVerMovimientos,
  alAbrirArqueo,
}: {
  tarjetas: readonly TarjetaAccion[];
  alVerMovimientos: () => void;
  /** Abre el arqueo de efectivo (`02 §7`); sin él, "Otra cantidad" no aparece como pantalla. */
  alAbrirArqueo?: () => void;
}) {
  if (tarjetas.length === 0) return null;
  return (
    <View style={{ gap: espacio.m }}>
      {tarjetas.map((t, i) => {
        const testID = `tarjeta-accion-${i}`;
        switch (t.tipo) {
          case 'pago_tarjeta':
            return <TarjetaPagoTarjeta key={`pago:${t.tarjetaId}:${t.corte}`} t={t} testID={testID} />;
          case 'confirmar_cobertura':
            return <TarjetaCobertura key={`cob:${t.programadoId}:${t.fecha}`} t={t} testID={testID} />;
          case 'liquidar_msi':
            return <PreguntaLiquidarMeses key={`liq:${t.tarjetaId}`} pregunta={t} testID={testID} />;
          case 'compromiso_vencido':
          case 'ingreso_no_llego':
            return <TarjetaOcurrencia key={`${t.programadoId}:${t.fecha}`} t={t} testID={testID} />;
          case 'tanda_aportacion':
          case 'tanda_cobro':
            return <TarjetaDeTanda key={`${t.tipo}:${t.tandaId}:${t.fecha}`} t={t} testID={testID} />;
          case 'arqueo':
            return (
              <TarjetaArqueo
                key={`arqueo:${t.cuentaId}`}
                t={t}
                testID={testID}
                alAbrirArqueo={alAbrirArqueo ?? (() => {})}
              />
            );
          case 'reactivar_captura':
            return <TarjetaReactivarCaptura key="reactivar_captura" testID={testID} />;
          case 'captura_inactiva':
            return <TarjetaCapturaInactiva key="captura_inactiva" testID={testID} />;
          case 'pregunta_captura':
            return (
              <TarjetaPreguntaCaptura
                key={`captura:${t.pregunta.capturaId}`}
                pregunta={t.pregunta}
                testID={testID}
              />
            );
          case 'capturas_por_revisar':
            return (
              <Tarjeta key="capturas_por_revisar" testID={testID}>
                <Texto variante="cuerpo">
                  {t.cantidad === 1
                    ? 'Registré 1 movimiento de tu banco que necesita que lo revises.'
                    : `Registré ${t.cantidad} movimientos de tu banco que necesitan que los revises.`}
                </Texto>
                <Boton etiqueta="Ver por revisar" variante="secundario" alPresionar={alVerMovimientos} />
              </Tarjeta>
            );
          case 'por_interpretar':
            return (
              <Tarjeta key="por_interpretar" testID={testID}>
                <Texto variante="cuerpo">
                  {t.cantidad === 1
                    ? 'Tienes 1 frase por revisar.'
                    : `Tienes ${t.cantidad} frases por revisar.`}
                </Texto>
                <Boton etiqueta="Ver por revisar" variante="secundario" alPresionar={alVerMovimientos} />
              </Tarjeta>
            );
          case 'por_asignar':
            return (
              <Tarjeta key="por_asignar" testID={testID}>
                <Texto variante="cuerpo">
                  {`Tienes ${formatearCentavos(t.monto)} en gastos sin cuenta. Los aparto de tu dinero libre hasta saber de dónde salieron.`}
                </Texto>
                <Boton etiqueta="Ver movimientos" variante="secundario" alPresionar={alVerMovimientos} />
              </Tarjeta>
            );
        }
      })}
    </View>
  );
}

/** "¿Ya pagaste la luz?" o "¿Ya te pagaron?": tres respuestas tocables; si falta la cuenta, la pregunta. */
function TarjetaOcurrencia({ t, testID }: { t: Compromiso | Ingreso; testID: string }) {
  const { ctx, refrescar } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const mostrar = useMostrarAviso();
  const [eligiendoCuenta, setEligiendoCuenta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = { programadoId: t.programadoId, fecha: t.fecha };
  const esIngreso = t.tipo === 'ingreso_no_llego';

  const registrar = (cuentaId?: string) => {
    setError(null);
    try {
      const r = esIngreso
        ? confirmarIngresoRecibido(ctx, { ...ref, ...(cuentaId ? { destinoId: cuentaId } : {}) })
        : yaLaPague(ctx, { ...ref, ...(cuentaId ? { origenId: cuentaId } : {}) });
      avisarRegistro(`Registré: ${t.concepto} ${formatearCentavos(t.monto)}`, r.deshacer);
    } catch (e) {
      if (codigoError(e) === 'cuenta_requerida') setEligiendoCuenta(true);
      else setError(mensajeError(e));
    }
  };
  const posponer = () => {
    todaviaNo(ctx, ref);
    refrescar();
    mostrar({
      mensaje: esIngreso ? 'Va. Te pregunto mañana.' : 'Lo sigo apartando. Te pregunto mañana.',
    });
  };
  const omitir = () => {
    omitirOcurrencia(ctx, ref);
    refrescar();
    mostrar({ mensaje: esIngreso ? 'Listo, no cuento con ese pago.' : 'Listo, ya no lo aparto.' });
  };

  const detalle = esIngreso
    ? `${formatearCentavos(t.monto)} · ${t.cuando === 'hoy' ? 'hoy' : t.etiquetaFecha}`
    : `${formatearCentavos(t.monto)}, vencía el ${t.etiquetaFecha}`;

  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{t.pregunta}</Texto>
      <Texto variante="secundario" tono="secundario">
        {detalle}
      </Texto>
      {eligiendoCuenta ? (
        <ElegirCuenta
          pregunta={esIngreso ? '¿A qué cuenta llegó?' : '¿De qué cuenta salió?'}
          alElegir={registrar}
          testID={`${testID}-cuenta`}
        />
      ) : (
        <View style={{ gap: espacio.s }}>
          <Boton
            etiqueta={esIngreso ? 'Sí, ya llegó' : 'Ya la pagué'}
            alPresionar={() => registrar()}
            testID={`${testID}-${esIngreso ? 'ya-llego' : 'ya-la-pague'}`}
          />
          <Boton
            etiqueta="Todavía no"
            variante="secundario"
            alPresionar={posponer}
            testID={`${testID}-todavia-no`}
          />
          <Boton
            etiqueta={esIngreso ? 'Este periodo no me pagan' : 'Ya no aplica'}
            variante="texto"
            alPresionar={omitir}
            testID={`${testID}-${esIngreso ? 'no-me-pagan' : 'ya-no-aplica'}`}
          />
        </View>
      )}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

function ElegirCuenta({
  pregunta,
  alElegir,
  testID,
}: {
  pregunta: string;
  alElegir: (id: string) => void;
  testID: string;
}) {
  const { ctx } = useSesion();
  const [cuentas] = useState(() => listarCuentas(ctx).tienes);
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="secundario">{pregunta}</Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={null}
        alCambiar={alElegir}
        prefijoTestID={testID}
      />
    </View>
  );
}

/**
 * 1. Pago de tarjeta que vence (`02 §4.1`): "Tu Banamex Oro ••8812 vence el lun 30." con el pago para no
 * generar intereses. "Ya la pagué" pregunta de qué cuenta salió y registra con Deshacer; "Todavía no" la oculta
 * hoy (sigue reservada).
 */
function TarjetaPagoTarjeta({ t, testID }: { t: PagoTarjeta; testID: string }) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [pagando, setPagando] = useState(false);
  const [pregunta, setPregunta] = useState<PreguntaLiquidar | null>(null);
  if (pregunta) return <PreguntaLiquidarMeses pregunta={pregunta} testID={`${testID}-liquidar`} />;
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{t.texto}</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Paga ${formatearCentavos(t.pngi)} para no generar intereses.`}
      </Texto>
      {pagando ? (
        <FormularioPago
          testID={`${testID}-pago`}
          tarjetaId={t.tarjetaId}
          nombre={t.nombre}
          montoSugerido={t.pngi}
          alTerminar={(r) => {
            setPagando(false);
            setPregunta(r.preguntaLiquidar);
          }}
          alCancelar={() => setPagando(false)}
        />
      ) : (
        <View style={{ gap: espacio.s }}>
          <Boton
            etiqueta="Ya la pagué"
            alPresionar={() => setPagando(true)}
            testID={`${testID}-ya-la-pague`}
          />
          <Boton
            etiqueta="Todavía no"
            variante="secundario"
            testID={`${testID}-todavia-no`}
            alPresionar={() => {
              todaviaNoPagoTarjeta(ctx, { tarjetaId: t.tarjetaId, corte: t.corte });
              refrescar();
              mostrar({ mensaje: 'Lo sigo apartando. Te pregunto mañana.' });
            }}
          />
        </View>
      )}
    </Tarjeta>
  );
}

/** 5. "¿Este pago fue la renta?" (E3.5 con monto distinto): Sí cubre el pago fijo; No lo deja pendiente. */
function TarjetaCobertura({ t, testID }: { t: Cobertura; testID: string }) {
  const { ctx, refrescar } = useSesion();
  const mostrar = useMostrarAviso();
  const [error, setError] = useState<string | null>(null);
  const ref = { programadoId: t.programadoId, fecha: t.fecha };
  const responder = (si: boolean) => {
    try {
      if (si) confirmarCobertura(ctx, ref);
      else rechazarCobertura(ctx, ref);
      refrescar();
      mostrar({
        mensaje: si
          ? `Listo: cuento ese pago como ${t.concepto}.`
          : `Va. Sigo apartando lo de ${t.concepto}.`,
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{t.pregunta}</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Pagaste ${formatearCentavos(t.montoMovimiento)}; esperaba ${formatearCentavos(t.montoProgramado)} el ${t.etiquetaFecha}.`}
      </Texto>
      <View style={{ gap: espacio.s }}>
        <Boton etiqueta="Sí" alPresionar={() => responder(true)} testID={`${testID}-si`} />
        <Boton
          etiqueta="No"
          variante="secundario"
          alPresionar={() => responder(false)}
          testID={`${testID}-no`}
        />
      </View>
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
