import type { Centavos } from '@cartera/core';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  liquidarMsi,
  listarCuentas,
  noEraParaLiquidar,
  pagarTarjeta,
  type MovimientoRegistrado,
  type PreguntaLiquidar,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, espacio, formatearCentavos, Tarjeta, Texto } from '../../ui';
import { GrupoChips } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { mensajePagoTarjeta } from './textos';

export function Seccion({
  titulo,
  subtitulo,
  children,
  testID,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <Texto variante="subtitulo" accessibilityRole="header">
        {titulo}
      </Texto>
      {subtitulo ? (
        <Texto variante="secundario" tono="secundario">
          {subtitulo}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

/** Una fila "etiqueta … cifra" del detalle. */
export function Dato({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <Texto variante="cuerpo" style={{ flex: 1 }}>
        {etiqueta}
      </Texto>
      <Texto variante="cuerpoFuerte" {...(testID ? { testID } : {})}>
        {valor}
      </Texto>
    </View>
  );
}

/** Chips con las cuentas de "Tienes" (efectivo, débito, billeteras, ahorro). */
export function ElegirCuenta({
  pregunta,
  valor,
  alElegir,
  prefijoTestID,
}: {
  pregunta: string;
  valor: string | null;
  alElegir: (id: string) => void;
  prefijoTestID: string;
}) {
  const cuentas = useVista((ctx) => listarCuentas(ctx).tienes);
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="secundario">{pregunta}</Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={valor}
        alCambiar={alElegir}
        prefijoTestID={prefijoTestID}
      />
    </View>
  );
}

/**
 * Pagar una tarjeta (`02 §8`): monto (por omisión, el pago para no generar intereses) y de qué cuenta salió.
 * Registra con "Deshacer" y devuelve lo registrado (puede traer la pregunta de liquidar meses).
 */
export function FormularioPago({
  tarjetaId,
  nombre,
  montoSugerido,
  alTerminar,
  alCancelar,
  testID = 'pagar',
}: {
  tarjetaId: string;
  nombre: string;
  montoSugerido: Centavos;
  alTerminar: (r: MovimientoRegistrado) => void;
  alCancelar: () => void;
  testID?: string;
}) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [monto, setMonto] = useState<Centavos | null>(montoSugerido > 0 ? montoSugerido : null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (monto === null || monto <= 0) {
      setError('Escribe cuánto pagaste.');
      return;
    }
    if (!origen) {
      setError('Elige de qué cuenta salió el pago.');
      return;
    }
    try {
      const r = pagarTarjeta(ctx, { tarjetaId, origenId: origen, monto });
      avisarRegistro(mensajePagoTarjeta(nombre, monto), r.deshacer);
      alTerminar(r);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <CampoMonto
        testID={`${testID}-monto`}
        etiqueta="¿Cuánto pagaste?"
        valorInicial={montoSugerido > 0 ? montoSugerido : null}
        alCambiar={setMonto}
      />
      <ElegirCuenta
        pregunta="¿De qué cuenta salió?"
        valor={origen}
        alElegir={setOrigen}
        prefijoTestID={`${testID}-origen`}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar pago" alPresionar={guardar} testID={`${testID}-guardar`} />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID={`${testID}-cancelar`} />
    </View>
  );
}

/**
 * "¿Este pago fue para liquidar tus meses?" (`02 §8`, CA-M4-10): un chip por plan ("Sí, la tele") y "No". El
 * saldo a favor nunca se muestra como dinero para gastar.
 */
export function PreguntaLiquidarMeses({
  pregunta,
  testID,
  alTerminar,
}: {
  pregunta: Pick<PreguntaLiquidar, 'tarjetaId' | 'tarjeta' | 'saldoAFavor' | 'pregunta' | 'planes'>;
  testID: string;
  alTerminar?: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const mostrar = useMostrarAviso();
  const [error, setError] = useState<string | null>(null);
  return (
    <Tarjeta testID={testID}>
      <Texto variante="cuerpoFuerte">{pregunta.pregunta}</Texto>
      <Texto variante="secundario" tono="secundario">
        {`Tu ${pregunta.tarjeta} quedó con saldo a favor de ${formatearCentavos(pregunta.saldoAFavor)}. No lo sumo a tu dinero libre.`}
      </Texto>
      <View style={{ gap: espacio.s }}>
        {pregunta.planes.map((p) => (
          <Boton
            key={p.planId}
            etiqueta={`Sí, ${p.descripcion}`}
            testID={`${testID}-si-${p.planId}`}
            alPresionar={() => {
              try {
                const l = liquidarMsi(ctx, p.planId);
                avisarRegistro(
                  `Listo: liquidaste ${p.descripcion} (${formatearCentavos(l.monto)}).`,
                  l.deshacer,
                );
                alTerminar?.();
              } catch (e) {
                setError(mensajeError(e));
              }
            }}
          />
        ))}
        <Boton
          etiqueta="No"
          variante="secundario"
          testID={`${testID}-no`}
          alPresionar={() => {
            try {
              noEraParaLiquidar(ctx, pregunta.tarjetaId);
              refrescar();
              mostrar({ mensaje: 'Va. El saldo a favor se queda en tu tarjeta.' });
              alTerminar?.();
            } catch (e) {
              setError(mensajeError(e));
            }
          }}
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
