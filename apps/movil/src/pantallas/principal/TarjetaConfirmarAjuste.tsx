import { useState } from 'react';
import { View } from 'react-native';
import { confirmarAjuste, etiquetaFecha, type OrigenDictado, type PropuestaAjuste } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import { formatearCentavos } from '../../ui/formato';
import { Chips } from '../onboarding/componentes';
import { describirRegla } from '../onboarding/pagos-fijos';
import {
  AYUDA_SALDO_DICHO,
  BTN_GUARDAR_INGRESO,
  BTN_GUARDAR_SALDO,
  mensajeColchonDicho,
  mensajeError,
  mensajeIngresoDicho,
  mensajeSaldoDicho,
  TEXTO_INGRESO_ANTES,
  TEXTO_INGRESO_DESPUES,
  TEXTO_SALDO_APP,
  TEXTO_SALDO_TU,
  TITULO_CONFIRMAR_INGRESO,
  TITULO_CONFIRMAR_SALDO,
  TITULO_ELEGIR_CUENTA_SALDO,
} from './textos';

type Clave = 'ingreso' | 'saldo' | 'colchon';

const CLAVE: Record<PropuestaAjuste['tipo'], Clave> = {
  ingreso: 'ingreso',
  saldo_cuenta: 'saldo',
  colchon: 'colchon',
};

/**
 * «Me pagan 8 mil cada quincena» o «tengo 4,200 en BBVA» desde Hoy o Registrar (`confirmar_ajuste`): cambian el
 * horizonte (E3.3) o lo que la app dice que tienes, así que nada cambia hasta «Guardar». Muestra lo de hoy junto a
 * lo nuevo; en el saldo, si la cuenta no quedó clara, primero se elige. El colchón dicho se aplica con Deshacer y
 * solo llega aquí si otra pantalla lo propone.
 */
export function TarjetaConfirmarAjuste({
  propuesta,
  origen,
  alGuardar,
  alCancelar,
}: {
  propuesta: PropuestaAjuste;
  origen: OrigenDictado;
  /** Recibe el aviso para la persona. */
  alGuardar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(
    propuesta.tipo === 'saldo_cuenta' ? propuesta.cuentaId : null,
  );
  const clave = CLAVE[propuesta.tipo];

  const guardar = () => {
    let mensaje: string;
    try {
      const g = confirmarAjuste(ctx, propuesta, origen, cuentaId ? { cuentaId } : {});
      if (g.tipo === 'ingreso' && propuesta.tipo === 'ingreso') {
        mensaje = mensajeIngresoDicho(
          propuesta.monto,
          describirRegla(propuesta.regla),
          propuesta.proximoPago ? etiquetaFecha(propuesta.proximoPago) : null,
        );
      } else if (g.tipo === 'saldo_cuenta') {
        mensaje = mensajeSaldoDicho(nombreCuenta(propuesta, g.cuentaId), g.saldo, g.transaccionId !== null);
      } else {
        mensaje = mensajeColchonDicho(propuesta.monto);
      }
    } catch (e) {
      setError(mensajeError(e));
      return;
    }
    refrescar();
    alGuardar(mensaje);
  };

  return (
    <Tarjeta testID={`confirmacion-${clave}`}>
      {propuesta.tipo === 'ingreso' ? (
        <>
          <Texto variante="subtitulo">{TITULO_CONFIRMAR_INGRESO}</Texto>
          {propuesta.anterior ? (
            <Fila
              titulo={TEXTO_INGRESO_ANTES}
              detalle={propuesta.anterior.concepto}
              centavos={propuesta.anterior.monto}
              testID="confirmacion-ingreso-antes"
            />
          ) : null}
          <Fila
            titulo={TEXTO_INGRESO_DESPUES}
            detalle={
              propuesta.proximoPago
                ? `${describirRegla(propuesta.regla)} · próximo pago ${etiquetaFecha(propuesta.proximoPago)}`
                : describirRegla(propuesta.regla)
            }
            centavos={propuesta.monto}
            testID="confirmacion-ingreso-despues"
          />
        </>
      ) : null}

      {propuesta.tipo === 'saldo_cuenta' ? (
        <>
          <Texto variante="subtitulo">{TITULO_CONFIRMAR_SALDO}</Texto>
          <Texto variante="secundario" tono="secundario">
            {AYUDA_SALDO_DICHO}
          </Texto>
          {propuesta.faltaCuenta && propuesta.faltaCuenta.candidatas.length > 0 ? (
            <Chips
              etiqueta={TITULO_ELEGIR_CUENTA_SALDO}
              opciones={propuesta.faltaCuenta.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              valor={cuentaId}
              alCambiar={setCuentaId}
              testID="confirmacion-saldo-cuenta"
            />
          ) : null}
          {propuesta.saldoActual !== null && cuentaId === propuesta.cuentaId ? (
            <Fila
              titulo={TEXTO_SALDO_APP}
              detalle={nombreCuenta(propuesta, cuentaId)}
              centavos={propuesta.saldoActual}
              testID="confirmacion-saldo-app"
            />
          ) : null}
          <Fila
            titulo={TEXTO_SALDO_TU}
            detalle={nombreCuenta(propuesta, cuentaId)}
            centavos={propuesta.monto}
            testID="confirmacion-saldo-tu"
          />
        </>
      ) : null}

      {propuesta.tipo === 'colchon' ? (
        <Fila
          titulo="Colchón"
          detalle={`Hoy apartas ${formatearCentavos(propuesta.actual)}`}
          centavos={propuesta.monto}
          testID="confirmacion-colchon-nuevo"
        />
      ) : null}

      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={
          propuesta.tipo === 'saldo_cuenta'
            ? BTN_GUARDAR_SALDO
            : propuesta.tipo === 'ingreso'
              ? BTN_GUARDAR_INGRESO
              : 'Guardar'
        }
        alPresionar={guardar}
        deshabilitado={propuesta.tipo === 'saldo_cuenta' && cuentaId === null}
        testID={`boton-guardar-${clave}`}
      />
      <Boton
        etiqueta="Cancelar"
        variante="texto"
        alPresionar={alCancelar}
        testID={`boton-cancelar-${clave}`}
      />
    </Tarjeta>
  );
}

/** Nombre de la cuenta del saldo: el de la candidata elegida, o «tu cuenta» si la app la resolvió sola. */
function nombreCuenta(propuesta: PropuestaAjuste, cuentaId: string | null): string {
  if (propuesta.tipo !== 'saldo_cuenta') return '';
  const candidata = propuesta.faltaCuenta?.candidatas.find((c) => c.id === cuentaId);
  return candidata?.nombre ?? 'tu cuenta';
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
      <View style={{ flex: 1, gap: espacio.xs }}>
        <Texto variante="cuerpoFuerte">{titulo}</Texto>
        <Texto variante="secundario" tono="secundario">
          {detalle}
        </Texto>
      </View>
      <Cifra centavos={centavos} contexto={`${titulo}, ${detalle}`} />
    </View>
  );
}
