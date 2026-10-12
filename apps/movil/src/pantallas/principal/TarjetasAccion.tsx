import { useState } from 'react';
import { View } from 'react-native';
import {
  confirmarIngresoRecibido,
  listarCuentas,
  omitirOcurrencia,
  todaviaNo,
  yaLaPague,
  type TarjetaAccion,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from './Chip';
import { useMostrarAviso } from './ProveedorAvisos';
import { codigoError, MENSAJE_ERROR_GENERAL } from './textos';
import { useAvisoRegistro } from './useAvisoRegistro';

type Compromiso = Extract<TarjetaAccion, { tipo: 'compromiso_vencido' }>;
type Ingreso = Extract<TarjetaAccion, { tipo: 'ingreso_no_llego' }>;

/** Tarjetas de acción de Hoy (02-UX §4.1); el servicio ya las ordena y limita a dos. */
export function TarjetasAccion({
  tarjetas,
  alVerMovimientos,
}: {
  tarjetas: readonly TarjetaAccion[];
  alVerMovimientos: () => void;
}) {
  if (tarjetas.length === 0) return null;
  return (
    <View style={{ gap: espacio.m }}>
      {tarjetas.map((t, i) => {
        const testID = `tarjeta-accion-${i}`;
        switch (t.tipo) {
          case 'compromiso_vencido':
          case 'ingreso_no_llego':
            return <TarjetaOcurrencia key={`${t.programadoId}:${t.fecha}`} t={t} testID={testID} />;
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
      else setError(MENSAJE_ERROR_GENERAL);
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
