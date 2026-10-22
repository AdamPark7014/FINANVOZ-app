import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { agregarCuenta } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Pantalla, Tarjeta, Texto } from '../../ui';
import { Chips } from '../onboarding/componentes';
import { conAnuncio, Encabezado, MensajeEnLinea } from './Encabezado';
import {
  AYUDA_SALDO_CUENTA,
  AYUDA_ULTIMOS4,
  BTN_GUARDAR_CUENTA,
  confirmacionCuentaAgregada,
  EJEMPLOS_NOMBRE_CUENTA,
  ERROR_CUENTA_INCOMPLETA,
  ERROR_GUARDAR,
  ERROR_ULTIMOS4,
  ETIQUETA_CHIP_AHORRO,
  ETIQUETA_CHIP_BILLETERA,
  ETIQUETA_CHIP_DEBITO,
  ETIQUETA_NOMBRE_CUENTA,
  ETIQUETA_SALDO_CUENTA,
  ETIQUETA_TIPO_CUENTA,
  ETIQUETA_ULTIMOS4,
  INTRO_NUEVA_CUENTA,
  PISTA_GUARDAR_CUENTA,
  TITULO_NUEVA_CUENTA,
} from './textos';

type TipoCuenta = 'debito' | 'billetera' | 'ahorro';

const OPCIONES_TIPO: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: ETIQUETA_CHIP_DEBITO },
  { valor: 'billetera', etiqueta: ETIQUETA_CHIP_BILLETERA },
  { valor: 'ahorro', etiqueta: ETIQUETA_CHIP_AHORRO },
];

/**
 * Cuentas › Tienes › Agregar cuenta (`02 §11`): el mismo formulario de O4 (`agregarCuenta`) para débito, billetera
 * o ahorro, después del onboarding. El saldo se guarda como saldo inicial de hoy.
 */
export function PantallaNuevaCuenta({
  alVolver,
  alGuardar,
}: {
  alVolver: () => void;
  /** Recibe la confirmación ya redactada («Listo: agregué BBVA.»). */
  alGuardar: (confirmacion: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const [tipo, setTipo] = useState<TipoCuenta>('debito');
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState<Centavos | null>(null);
  const [ultimos4, setUltimos4] = useState('');
  const [error, setErrorBase] = useState<string | null>(null);
  const setError = conAnuncio(setErrorBase);

  const guardar = () => {
    const limpio = nombre.trim();
    if (limpio === '' || saldo === null) {
      setError(ERROR_CUENTA_INCOMPLETA);
      return;
    }
    const u4 = ultimos4.trim();
    if (u4 !== '' && !/^\d{4}$/.test(u4)) {
      setError(ERROR_ULTIMOS4);
      return;
    }
    try {
      agregarCuenta(ctx, { subtipo: tipo, nombre: limpio, saldo, ...(u4 ? { ultimos4: u4 } : {}) });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setErrorBase(null);
    refrescar();
    alGuardar(confirmacionCuentaAgregada(limpio));
  };

  return (
    <Pantalla
      testID="cuenta-nueva"
      bordes={['top', 'left', 'right', 'bottom']}
      pie={
        <Boton
          testID="cuenta-nueva-guardar"
          etiqueta={BTN_GUARDAR_CUENTA}
          pista={PISTA_GUARDAR_CUENTA}
          alPresionar={guardar}
        />
      }
    >
      <Encabezado titulo={TITULO_NUEVA_CUENTA} alVolver={alVolver} testID="cuenta-nueva" />
      <Texto variante="secundario" tono="secundario">
        {INTRO_NUEVA_CUENTA}
      </Texto>
      <Tarjeta>
        <Chips
          testID="cuenta-nueva-tipo"
          etiqueta={ETIQUETA_TIPO_CUENTA}
          opciones={OPCIONES_TIPO}
          valor={tipo}
          alCambiar={setTipo}
        />
        <CampoTexto
          testID="cuenta-nueva-nombre"
          etiqueta={ETIQUETA_NOMBRE_CUENTA}
          ejemplo={EJEMPLOS_NOMBRE_CUENTA[tipo]}
          valor={nombre}
          alCambiar={setNombre}
          nativo={{ maxLength: 60, autoCapitalize: 'words' }}
        />
        <CampoMonto
          testID="cuenta-nueva-saldo"
          etiqueta={ETIQUETA_SALDO_CUENTA}
          ayuda={AYUDA_SALDO_CUENTA}
          alCambiar={setSaldo}
          admiteCero
        />
        <CampoTexto
          testID="cuenta-nueva-ultimos4"
          etiqueta={ETIQUETA_ULTIMOS4}
          ayuda={AYUDA_ULTIMOS4}
          ejemplo="1234"
          teclado="number-pad"
          valor={ultimos4}
          alCambiar={setUltimos4}
          nativo={{ maxLength: 4 }}
        />
      </Tarjeta>
      <MensajeEnLinea texto={error} error testID="cuenta-nueva-error" />
    </Pantalla>
  );
}
