import { useState } from 'react';
import { View } from 'react-native';
import { aportarTanda, cobrarTanda, listarCuentas, type MovimientoTanda } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Texto } from '../../ui';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { codigoError, mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import {
  ETIQUETA_CANCELAR,
  PISTA_CANCELAR_APORTACION,
  PISTA_CANCELAR_COBRO,
  TEXTO_SIN_CUENTAS_TANDA,
  mensajeAportacion,
  mensajeCobro,
  PREGUNTA_CUENTA_LLEGO,
  PREGUNTA_CUENTA_SALIO,
} from './textos';

/** Chips con las cuentas de las que puede salir o a las que puede llegar la tanda (efectivo, débito, billetera). */
export function ElegirCuentaTanda({
  pregunta,
  alElegir,
  prefijoTestID,
}: {
  pregunta: string;
  alElegir: (id: string) => void;
  prefijoTestID: string;
}) {
  const cuentas = useVista((ctx) => listarCuentas(ctx).tienes.filter((c) => c.subtipo !== 'ahorro'));
  if (cuentas.length === 0) {
    // Sin cuentas no hay chips que tocar: se dice qué hacer en vez de dejar la pregunta sola.
    return (
      <Texto variante="secundario" tono="secundario" testID={`${prefijoTestID}-sin-cuentas`}>
        {TEXTO_SIN_CUENTAS_TANDA}
      </Texto>
    );
  }
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
        {pregunta}
      </Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={null}
        alCambiar={alElegir}
        prefijoTestID={prefijoTestID}
        etiqueta={pregunta}
      />
    </View>
  );
}

/**
 * "Ya la di" (`02 §18`): registra la aportación de esa ronda; si la tanda no tiene cuenta, pregunta de dónde salió.
 * Avisa con "Deshacer".
 */
export function useYaLaDi(tandaId: string, fecha: string | null, testID: string) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dar = (cuentaId?: string) => {
    setError(null);
    try {
      const m: MovimientoTanda = aportarTanda(ctx, {
        tandaId,
        ...(fecha ? { fecha } : {}),
        ...(cuentaId ? { cuentaId } : {}),
      });
      setEligiendo(false);
      avisarRegistro(mensajeAportacion(m), m.deshacer);
    } catch (e) {
      if (codigoError(e) === 'cuenta_requerida') setEligiendo(true);
      else setError(mensajeError(e));
    }
  };
  // "¿De dónde salió?" con su "Cancelar": antes solo se salía eligiendo una cuenta.
  const elegir = eligiendo ? (
    <View style={{ gap: espacio.s }}>
      <ElegirCuentaTanda pregunta={PREGUNTA_CUENTA_SALIO} alElegir={dar} prefijoTestID={`${testID}-cuenta`} />
      <Boton
        testID={`${testID}-cuenta-cancelar`}
        etiqueta={ETIQUETA_CANCELAR}
        variante="texto"
        ancho="contenido"
        alPresionar={() => setEligiendo(false)}
        pista={PISTA_CANCELAR_APORTACION}
      />
    </View>
  ) : null;
  return { dar, elegir, error };
}

/** "Me tocó la tanda": pregunta a qué cuenta llegó y registra el cobro (no es ingreso). */
export function MeTocoLaTanda({
  tandaId,
  testID,
  alTerminar,
}: {
  tandaId: string;
  testID: string;
  alTerminar?: () => void;
}) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: espacio.s }}>
      <ElegirCuentaTanda
        pregunta={PREGUNTA_CUENTA_LLEGO}
        prefijoTestID={`${testID}-cuenta`}
        alElegir={(cuentaId) => {
          try {
            const m = cobrarTanda(ctx, { tandaId, cuentaId });
            avisarRegistro(mensajeCobro(m), m.deshacer);
            alTerminar?.();
          } catch (e) {
            setError(mensajeError(e));
          }
        }}
      />
      {alTerminar ? (
        <Boton
          testID={`${testID}-cancelar`}
          etiqueta={ETIQUETA_CANCELAR}
          variante="texto"
          ancho="contenido"
          alPresionar={alTerminar}
          pista={PISTA_CANCELAR_COBRO}
        />
      ) : null}
      {error ? (
        <Texto
          variante="secundario"
          tono="faltante"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={error}
        >
          {error}
        </Texto>
      ) : null}
    </View>
  );
}
