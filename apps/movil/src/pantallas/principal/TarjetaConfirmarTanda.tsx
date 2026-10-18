import { useState } from 'react';
import { View } from 'react-native';
import { confirmarTanda, type OrigenDictado, type ResultadoTexto } from '../../servicios/registrar';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import { TEXTO_NO_ES_INGRESO } from '../tandas/textos';
import { GrupoChips } from './Chip';
import { mensajeError, PREGUNTA_CUENTA_TANDA, TITULO_CONFIRMAR_TANDA } from './textos';

type ConfirmarTanda = Extract<ResultadoTexto, { resultado: 'confirmar_tanda' }>;
type RegistradoTanda = Extract<ResultadoTexto, { resultado: 'registrado_tanda' }>;

/**
 * Aportación o cobro de tanda dictado que necesita confirmación (TK02): tanda, cuenta o monto. Nada se guarda
 * hasta "Guardar"; al guardar, `confirmarTanda` registra el movimiento.
 */
export function TarjetaConfirmarTanda({
  datos,
  origen,
  alGuardar,
  alCancelar,
}: {
  datos: ConfirmarTanda;
  origen: OrigenDictado;
  alGuardar: (r: RegistradoTanda) => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const { propuesta, motivo } = datos;
  const esCobro = propuesta.tipo === 'cobro_tanda';
  const [tandaId, setTandaId] = useState<string | null>(propuesta.tandaId);
  const [cuentaId, setCuentaId] = useState<string | null>(
    propuesta.cuentaId ??
      (propuesta.faltaCuenta?.motivo === 'aproximado' && propuesta.faltaCuenta.candidatas.length === 1
        ? (propuesta.faltaCuenta.candidatas[0]?.id ?? null)
        : null),
  );
  const [error, setError] = useState<string | null>(null);
  const completo = tandaId !== null && cuentaId !== null;

  const guardar = () => {
    if (!tandaId || !cuentaId) return;
    const falta = propuesta.faltaCuenta;
    const alias = falta && falta.motivo !== 'ambigua' ? falta.alias : null;
    try {
      alGuardar(
        confirmarTanda(
          ctx,
          {
            tandaId,
            cuentaId,
            monto: propuesta.monto,
            tipo: propuesta.tipo,
            fecha: propuesta.fecha,
            ...(propuesta.claveIdempotencia ? { claveIdempotencia: propuesta.claveIdempotencia } : {}),
          },
          origen,
          alias ? { aprender: { alias } } : {},
        ),
      );
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Tarjeta testID="confirmacion-tanda">
      <Texto variante="subtitulo">{TITULO_CONFIRMAR_TANDA[motivo]}</Texto>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
          {esCobro ? 'Cobro de tanda' : 'Aportación de tanda'}
        </Texto>
        <Cifra centavos={propuesta.monto} />
      </View>
      {esCobro ? (
        <Texto variante="secundario" tono="secundario">
          {TEXTO_NO_ES_INGRESO}
        </Texto>
      ) : null}
      {propuesta.tandas.length > 1 ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario">
            ¿De cuál tanda?
          </Texto>
          <GrupoChips
            opciones={propuesta.tandas.map((t) => ({ valor: t.id, etiqueta: t.nombre }))}
            valor={tandaId}
            alCambiar={setTandaId}
            prefijoTestID="tanda-confirmar-tanda"
          />
        </View>
      ) : null}
      {propuesta.faltaCuenta ? (
        <View style={{ gap: espacio.xs }}>
          <Texto variante="secundario" tono="secundario">
            {propuesta.faltaCuenta.motivo === 'no_encontrada' && propuesta.faltaCuenta.alias
              ? `No tengo una cuenta «${propuesta.faltaCuenta.alias}». ¿Cuál fue?`
              : PREGUNTA_CUENTA_TANDA[esCobro ? 'cobro' : 'aportacion']}
          </Texto>
          <GrupoChips
            opciones={propuesta.faltaCuenta.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            valor={cuentaId}
            alCambiar={setCuentaId}
            prefijoTestID="tanda-confirmar-cuenta"
          />
        </View>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar" alPresionar={guardar} deshabilitado={!completo} testID="boton-guardar-tanda" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-tanda" />
    </Tarjeta>
  );
}
