import { useState } from 'react';
import { View } from 'react-native';
import { confirmarSaldoDicho, type OrigenDictado, type PropuestaSaldo } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import {
  AYUDA_SALDO_DICHO,
  BTN_AJUSTAR_SALDO,
  mensajeError,
  mensajeSaldoAjustado,
  TEXTO_SALDO_DICES,
  TEXTO_SALDO_LLEVO,
  tituloConfirmarSaldo,
} from './textos';

/** «Tengo 4,200 en BBVA» (`04 §6` caso 22): nada cambia hasta «Ajustar», que registra la conciliación. */
export function TarjetaConfirmarSaldo({
  propuesta,
  origen,
  alGuardar,
  alCancelar,
}: {
  propuesta: PropuestaSaldo;
  origen: OrigenDictado;
  /** Recibe el aviso para la persona y el id de la conciliación (Deshacer). */
  alGuardar: (mensaje: string, transaccionId: string | null) => void;
  alCancelar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const guardar = () => {
    let id: string | null;
    try {
      id = confirmarSaldoDicho(ctx, propuesta, origen === 'voz' ? 'voz' : 'texto');
    } catch (e) {
      setError(mensajeError(e));
      return;
    }
    refrescar();
    alGuardar(mensajeSaldoAjustado(propuesta.nombre, propuesta.saldoReal), id);
  };
  return (
    <Tarjeta testID="confirmacion-saldo">
      <Texto variante="subtitulo">{tituloConfirmarSaldo(propuesta.nombre)}</Texto>
      <Fila titulo={TEXTO_SALDO_LLEVO} centavos={propuesta.saldoLibro} testID="confirmacion-saldo-llevo" />
      <Fila titulo={TEXTO_SALDO_DICES} centavos={propuesta.saldoReal} testID="confirmacion-saldo-dices" />
      <Texto variante="secundario" tono="secundario">
        {AYUDA_SALDO_DICHO}
      </Texto>
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta={BTN_AJUSTAR_SALDO} alPresionar={guardar} testID="boton-ajustar-saldo" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-saldo" />
    </Tarjeta>
  );
}

function Fila({ titulo, centavos, testID }: { titulo: string; centavos: number; testID: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <Texto variante="cuerpoFuerte">{titulo}</Texto>
      <Cifra centavos={centavos} contexto={titulo} />
    </View>
  );
}
