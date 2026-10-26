import { useState } from 'react';
import { View } from 'react-native';
import { tomarPrellenado } from '../../asistente/flujos';
import { proponerTanda, type ResultadoTexto } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, espacio, Pantalla, Texto } from '../../ui';
import { FormularioCuentaDividida } from '../personas/FormularioCuentaDividida';
import { TITULO_CONFIRMAR_DIVISION } from '../personas/textos';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { FormularioTanda } from '../tandas/FormularioTanda';
import { TarjetaConfirmarMsi } from '../tarjetas/TarjetaConfirmarMsi';
import { ACCESIBILIDAD_CERRAR_R2, BTN_CERRAR_R2, PISTA_CERRAR_R2 } from './textos';
import { MENSAJE_TANDA_GUARDADA } from './turnos/TurnoTarjeta';

/** Formularios largos que «Cambiar algo» de un flujo abre en `/registrar?flujo=…` (A-3). */
export type FlujoLargo = 'msi' | 'tanda' | 'cuenta_dividida';

export function esFlujoLargo(x: unknown): x is FlujoLargo {
  return x === 'msi' || x === 'tanda' || x === 'cuenta_dividida';
}

const TITULO: Record<FlujoLargo, string> = {
  msi: 'Compra a meses',
  tanda: 'Tu tanda',
  cuenta_dividida: TITULO_CONFIRMAR_DIVISION,
};

/**
 * «Cambiar algo» de un flujo conversacional (§6): el formulario de siempre con lo dicho ya puesto (en memoria,
 * `tomarPrellenado`, regla 9). Al guardar vuelve al asistente, que muestra el registro con Deshacer.
 */
export function PantallaFormularioLargo({
  flujo,
  alCerrar,
  alResultado,
  alMensaje,
}: {
  flujo: FlujoLargo;
  alCerrar: () => void;
  /** Compra a meses o cuenta dividida guardada: el asistente la muestra como resultado. */
  alResultado: (r: ResultadoTexto) => void;
  /** Tanda guardada: solo el mensaje. */
  alMensaje: (mensaje: string) => void;
}) {
  const { ctx } = useSesion();
  // Lo dicho se toma una sola vez al abrir.
  const [msi] = useState(() => (flujo === 'msi' ? tomarPrellenado('msi') : null));
  const [division] = useState(() =>
    flujo === 'cuenta_dividida' ? tomarPrellenado('cuenta_dividida') : null,
  );
  const [tanda] = useState(() => {
    if (flujo !== 'tanda') return null;
    const entrada = tomarPrellenado('tanda');
    if (!entrada) return null;
    try {
      return proponerTanda(ctx, entrada);
    } catch {
      // Lo dicho no alcanza para proponerla: el formulario abre vacío.
      return null;
    }
  });
  return (
    <ProveedorAvisos>
      <Pantalla
        testID="pantalla-formulario-largo"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: espacio.s,
            paddingBottom: espacio.xs,
          }}
        >
          <Boton
            etiqueta={BTN_CERRAR_R2}
            variante="texto"
            ancho="contenido"
            alPresionar={alCerrar}
            etiquetaAccesible={ACCESIBILIDAD_CERRAR_R2}
            pista={PISTA_CERRAR_R2}
            testID="boton-cerrar-registrar"
          />
          <Texto variante="subtitulo" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>
            {TITULO[flujo]}
          </Texto>
          <View style={{ width: 64 }} />
        </View>
        {flujo === 'msi' && msi ? (
          <TarjetaConfirmarMsi
            datos={msi}
            origen="texto"
            alGuardar={(r) => {
              alResultado(r);
              alCerrar();
            }}
            alCancelar={alCerrar}
          />
        ) : null}
        {flujo === 'cuenta_dividida' ? (
          <FormularioCuentaDividida
            {...(division ? { prellenado: division } : {})}
            origen="texto"
            alGuardar={(r) => {
              alResultado(r);
              alCerrar();
            }}
            alCancelar={alCerrar}
          />
        ) : null}
        {flujo === 'tanda' ? (
          <FormularioTanda
            prellenado={tanda}
            alGuardar={() => {
              alMensaje(MENSAJE_TANDA_GUARDADA);
              alCerrar();
            }}
            alCancelar={alCerrar}
          />
        ) : null}
        <View style={{ height: espacio.xxxl }} />
      </Pantalla>
    </ProveedorAvisos>
  );
}
