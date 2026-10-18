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
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import {
  AVISO_SALDO_A_FAVOR_EN_TARJETA,
  BTN_CANCELAR,
  BTN_GUARDAR_PAGO,
  BTN_NO,
  PISTA_GUARDAR_PAGO_TARJETA,
  ERROR_MONTO_PAGO,
  ERROR_ORIGEN_PAGO,
  ETIQUETA_MONTO_PAGO,
  etiquetaAccesibleDato,
  etiquetaSiLiquidar,
  mensajeLiquidacionPlan,
  mensajePagoTarjeta,
  PREGUNTA_CUENTA_PAGO,
  textoSaldoAFavorTrasPago,
} from './textos';

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
    <View
      accessible
      accessibilityLabel={etiquetaAccesibleDato(etiqueta, valor)}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
    >
      <Texto variante="cuerpo" style={{ flex: 1 }} importantForAccessibility="no">
        {etiqueta}
      </Texto>
      <Texto variante="cuerpoFuerte" importantForAccessibility="no" {...(testID ? { testID } : {})}>
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
      <Texto variante="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
        {pregunta}
      </Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={valor}
        alCambiar={alElegir}
        prefijoTestID={prefijoTestID}
        etiqueta={pregunta}
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
      setError(ERROR_MONTO_PAGO);
      return;
    }
    if (!origen) {
      setError(ERROR_ORIGEN_PAGO);
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
        etiqueta={ETIQUETA_MONTO_PAGO}
        valorInicial={montoSugerido > 0 ? montoSugerido : null}
        alCambiar={setMonto}
      />
      <ElegirCuenta
        pregunta={PREGUNTA_CUENTA_PAGO}
        valor={origen}
        alElegir={setOrigen}
        prefijoTestID={`${testID}-origen`}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={BTN_GUARDAR_PAGO}
        alPresionar={guardar}
        testID={`${testID}-guardar`}
        pista={PISTA_GUARDAR_PAGO_TARJETA}
      />
      <Boton
        etiqueta={BTN_CANCELAR}
        variante="texto"
        alPresionar={alCancelar}
        testID={`${testID}-cancelar`}
      />
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
        {textoSaldoAFavorTrasPago(pregunta.tarjeta, formatearCentavos(pregunta.saldoAFavor))}
      </Texto>
      <View style={{ gap: espacio.s }}>
        {pregunta.planes.map((p) => (
          <Boton
            key={p.planId}
            etiqueta={etiquetaSiLiquidar(p.descripcion)}
            testID={`${testID}-si-${p.planId}`}
            alPresionar={() => {
              try {
                const l = liquidarMsi(ctx, p.planId);
                avisarRegistro(
                  mensajeLiquidacionPlan(p.descripcion, formatearCentavos(l.monto)),
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
          etiqueta={BTN_NO}
          variante="secundario"
          testID={`${testID}-no`}
          alPresionar={() => {
            try {
              noEraParaLiquidar(ctx, pregunta.tarjetaId);
              refrescar();
              mostrar({ mensaje: AVISO_SALDO_A_FAVOR_EN_TARJETA });
              alTerminar?.();
            } catch (e) {
              setError(mensajeError(e));
            }
          }}
        />
      </View>
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
