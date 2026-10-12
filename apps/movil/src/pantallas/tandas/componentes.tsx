import { useState } from 'react';
import { View } from 'react-native';
import { aportarTanda, cobrarTanda, listarCuentas, type MovimientoTanda } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Texto } from '../../ui';
import { GrupoChips } from '../principal/Chip';
import { codigoError, mensajeError } from '../principal/textos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { mensajeAportacion, mensajeCobro } from './textos';

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
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto variante="secundario">{pregunta}</Texto>
      <GrupoChips
        opciones={cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        valor={null}
        alCambiar={alElegir}
        prefijoTestID={prefijoTestID}
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
  const elegir = eligiendo ? (
    <ElegirCuentaTanda pregunta="¿De qué cuenta salió?" alElegir={dar} prefijoTestID={`${testID}-cuenta`} />
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
        pregunta="¿A qué cuenta llegó?"
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
        <Boton etiqueta="Cancelar" variante="texto" ancho="contenido" alPresionar={alTerminar} />
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
    </View>
  );
}
