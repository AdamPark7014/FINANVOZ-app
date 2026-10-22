import { useState } from 'react';
import { View } from 'react-native';
import { confirmarIngresoDicho, etiquetaFecha, type PropuestaIngreso } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import { describirRegla } from '../onboarding/pagos-fijos';
import {
  BTN_GUARDAR_INGRESO,
  mensajeError,
  mensajeIngresoDicho,
  TEXTO_INGRESO_ANTES,
  TEXTO_INGRESO_DESPUES,
  TITULO_CONFIRMAR_INGRESO,
} from './textos';

/**
 * «Me pagan 8 mil cada quincena» desde Hoy o Registrar: el ingreso define el horizonte (E3.3), así que nada cambia
 * hasta «Cambiar mi ingreso». Muestra el ingreso de hoy junto al nuevo.
 */
export function TarjetaConfirmarIngreso({
  propuesta,
  alGuardar,
  alCancelar,
}: {
  propuesta: PropuestaIngreso;
  /** Recibe el aviso para la persona. */
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const cuando = describirRegla(propuesta.regla);
  const guardar = () => {
    try {
      confirmarIngresoDicho(ctx, propuesta);
    } catch (e) {
      setError(mensajeError(e));
      return;
    }
    refrescar();
    alGuardar(
      mensajeIngresoDicho(
        propuesta.monto,
        cuando,
        propuesta.proximo ? etiquetaFecha(propuesta.proximo) : null,
      ),
    );
  };
  return (
    <Tarjeta testID="confirmacion-ingreso">
      <Texto variante="subtitulo">{TITULO_CONFIRMAR_INGRESO}</Texto>
      {propuesta.anterior ? (
        <Fila
          titulo={TEXTO_INGRESO_ANTES}
          detalle={describirRegla(propuesta.anterior.regla)}
          centavos={propuesta.anterior.monto}
          testID="confirmacion-ingreso-antes"
        />
      ) : null}
      <Fila
        titulo={TEXTO_INGRESO_DESPUES}
        detalle={propuesta.proximo ? `${cuando} · próximo pago ${etiquetaFecha(propuesta.proximo)}` : cuando}
        centavos={propuesta.monto}
        testID="confirmacion-ingreso-despues"
      />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta={BTN_GUARDAR_INGRESO} alPresionar={guardar} testID="boton-guardar-ingreso" />
      <Boton etiqueta="Cancelar" variante="texto" alPresionar={alCancelar} testID="boton-cancelar-ingreso" />
    </Tarjeta>
  );
}

function Fila({
  titulo,
  detalle,
  centavos,
  testID,
}: {
  titulo: string;
  detalle: string;
  centavos: number;
  testID: string;
}) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <Texto variante="cuerpoFuerte">{titulo}</Texto>
        <Texto variante="secundario" tono="secundario">
          {detalle}
        </Texto>
      </View>
      <Cifra centavos={centavos} contexto={`${titulo}, ${detalle}`} />
    </View>
  );
}
