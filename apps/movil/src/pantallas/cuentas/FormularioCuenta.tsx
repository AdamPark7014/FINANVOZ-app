import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { agregarCuenta } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta } from '../../ui';
import { Chips, ERROR_GUARDAR, MensajeError } from '../onboarding/componentes';
import {
  BTN_AGREGAR_CUENTA_ONB,
  BTN_ONB_CANCELAR,
  EJEMPLO_NOMBRE_BILLETERA,
  EJEMPLO_NOMBRE_DEBITO,
  ERROR_CUENTA_INCOMPLETA,
  ETIQUETA_CHIP_AHORRO,
  ETIQUETA_CHIP_BILLETERA,
  ETIQUETA_CHIP_DEBITO,
  ETIQUETA_NOMBRE_CUENTA,
  ETIQUETA_SALDO_CUENTA_ONB,
} from '../onboarding/textos';

type TipoCuenta = 'debito' | 'billetera' | 'ahorro';

const OPCIONES_TIPO: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: ETIQUETA_CHIP_DEBITO },
  { valor: 'billetera', etiqueta: ETIQUETA_CHIP_BILLETERA },
  { valor: 'ahorro', etiqueta: ETIQUETA_CHIP_AHORRO },
];

/**
 * Alta de una cuenta de débito, billetera o ahorro con su saldo de hoy (O4 y Cuentas › «Agregar cuenta»). El saldo
 * se guarda como saldo inicial en servicios; `alGuardar` recibe el id de la cuenta nueva.
 */
export function FormularioCuenta({
  alGuardar,
  alCancelar,
  testID = 'onb-cuenta',
}: {
  alGuardar: (cuentaId: string) => void;
  alCancelar: () => void;
  testID?: string;
}) {
  const { ctx, refrescar } = useSesion();
  const [tipo, setTipo] = useState<TipoCuenta>('debito');
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState<Centavos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregar = () => {
    if (nombre.trim() === '' || saldo === null) {
      setError(ERROR_CUENTA_INCOMPLETA);
      return;
    }
    let id: string;
    try {
      id = agregarCuenta(ctx, { subtipo: tipo, nombre: nombre.trim(), saldo });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setError(null);
    refrescar();
    alGuardar(id);
  };

  return (
    <Tarjeta testID={`${testID}-formulario`}>
      <Chips testID={`${testID}-tipo`} opciones={OPCIONES_TIPO} valor={tipo} alCambiar={setTipo} />
      <CampoTexto
        testID={`${testID}-nombre`}
        etiqueta={ETIQUETA_NOMBRE_CUENTA}
        ejemplo={tipo === 'billetera' ? EJEMPLO_NOMBRE_BILLETERA : EJEMPLO_NOMBRE_DEBITO}
        valor={nombre}
        alCambiar={setNombre}
      />
      <CampoMonto testID={`${testID}-saldo`} etiqueta={ETIQUETA_SALDO_CUENTA_ONB} alCambiar={setSaldo} />
      <Boton testID={`${testID}-agregar`} etiqueta={BTN_AGREGAR_CUENTA_ONB} alPresionar={agregar} />
      <Boton
        testID={`${testID}-cancelar`}
        variante="texto"
        etiqueta={BTN_ONB_CANCELAR}
        alPresionar={alCancelar}
      />
      <MensajeError texto={error} />
    </Tarjeta>
  );
}
