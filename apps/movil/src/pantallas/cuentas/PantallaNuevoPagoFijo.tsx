import { Boton, espacio, Pantalla, Tarjeta } from '../../ui';
import { useFormularioPagoFijo } from '../pagos-fijos/FormularioPagoFijo';
import { Encabezado, MensajeEnLinea } from './Encabezado';
import { confirmacionPagoAgregado, PISTA_GUARDAR_PAGO, TITULO_NUEVO_PAGO } from './textos';

/**
 * Cuentas › Compromisos › Agregar pago fijo (`02 §11`): el formulario de O5 (`useFormularioPagoFijo`, con «O
 * dímelo») en su propia pantalla, con «Agregar …» en el pie para que el teclado del iPhone no lo tape. Al guardar
 * regresa a Cuentas con «Listo: agregué renta. Ya lo aparto.».
 */
export function PantallaNuevoPagoFijo({
  alVolver,
  alGuardar,
}: {
  alVolver: () => void;
  /** Recibe la confirmación ya redactada («Listo: agregué renta. Ya lo aparto.»). */
  alGuardar: (confirmacion: string) => void;
}) {
  const f = useFormularioPagoFijo({
    testID: 'pago-nuevo',
    alAgregado: (pago) => alGuardar(confirmacionPagoAgregado(pago.conceptoGuardado)),
  });
  return (
    <Pantalla
      testID="pago-nuevo"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
      {...(f.clave !== null
        ? {
            pie: (
              <Boton
                testID="pago-nuevo-guardar"
                etiqueta={f.etiquetaAgregar}
                pista={PISTA_GUARDAR_PAGO}
                alPresionar={f.agregar}
              />
            ),
          }
        : {})}
    >
      <Encabezado titulo={TITULO_NUEVO_PAGO} alVolver={alVolver} testID="pago-nuevo" />
      {f.encabezado}
      {f.clave !== null ? (
        <Tarjeta key={f.llave} testID="pago-nuevo-formulario">
          {f.campos}
        </Tarjeta>
      ) : null}
      <MensajeEnLinea texto={f.error} error testID="pago-nuevo-error" />
    </Pantalla>
  );
}
