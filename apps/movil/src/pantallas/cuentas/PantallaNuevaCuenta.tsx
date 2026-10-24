import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import { Encabezado, MensajeEnLinea } from './Encabezado';
import { useFormularioCuenta } from './FormularioCuenta';
import {
  BTN_GUARDAR_CUENTA,
  confirmacionCuentaAgregada,
  INTRO_NUEVA_CUENTA,
  PISTA_GUARDAR_CUENTA,
  TITULO_NUEVA_CUENTA,
} from './textos';

/**
 * Cuentas › Tienes › Agregar cuenta (`02 §11`): el formulario de O4 (`useFormularioCuenta`) en su propia pantalla,
 * con «Guardar cuenta» en el pie para que el teclado del iPhone no lo tape. El saldo se guarda como saldo inicial
 * de hoy.
 */
export function PantallaNuevaCuenta({
  alVolver,
  alGuardar,
}: {
  alVolver: () => void;
  /** Recibe la confirmación ya redactada («Listo: agregué BBVA.»). */
  alGuardar: (confirmacion: string) => void;
}) {
  const f = useFormularioCuenta({
    testID: 'cuenta-nueva',
    alGuardar: (_id, nombre) => alGuardar(confirmacionCuentaAgregada(nombre)),
  });
  return (
    <Pantalla
      testID="cuenta-nueva"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
      pie={
        <Boton
          testID="cuenta-nueva-guardar"
          etiqueta={BTN_GUARDAR_CUENTA}
          pista={PISTA_GUARDAR_CUENTA}
          alPresionar={f.guardar}
        />
      }
    >
      <Encabezado titulo={TITULO_NUEVA_CUENTA} alVolver={alVolver} testID="cuenta-nueva" />
      <Texto variante="secundario" tono="secundario">
        {INTRO_NUEVA_CUENTA}
      </Texto>
      <Tarjeta testID="cuenta-nueva-formulario">{f.campos}</Tarjeta>
      <MensajeEnLinea texto={f.error} error testID="cuenta-nueva-error" />
    </Pantalla>
  );
}
