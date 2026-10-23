import type { Centavos } from '@cartera/core';
import { useState, type ReactNode } from 'react';
import { agregarCuenta } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta } from '../../ui';
import { Chips, MensajeError } from '../onboarding/componentes';
import { conAnuncio } from './Encabezado';
import {
  AYUDA_SALDO_CUENTA,
  AYUDA_ULTIMOS4,
  BTN_AGREGAR_CUENTA,
  BTN_CANCELAR,
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
  PISTA_AGREGAR_CUENTA_FORMULARIO,
  PISTA_CANCELAR_CUENTA,
} from './textos';

export type TipoCuenta = 'debito' | 'billetera' | 'ahorro';

const OPCIONES_TIPO: readonly { valor: TipoCuenta; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: ETIQUETA_CHIP_DEBITO },
  { valor: 'billetera', etiqueta: ETIQUETA_CHIP_BILLETERA },
  { valor: 'ahorro', etiqueta: ETIQUETA_CHIP_AHORRO },
];

/** Lo que ya se sabe de la cuenta (lo dicho o lo leído); lo demás queda vacío para que la persona lo llene. */
export interface CuentaPrellenada {
  tipo?: TipoCuenta;
  nombre?: string;
  saldo?: Centavos | null;
  ultimos4?: string;
}

/** Campos que pueden recibir el foco (el tipo son chips). */
export type CampoCuenta = 'nombre' | 'saldo' | 'ultimos4';

/**
 * El primer dato que falta en lo dicho, para llevar ahí el foco al llenar el formulario (Ola 7 §7). Los últimos 4
 * son opcionales: si ya están nombre y saldo, el foco va al saldo, lo más fácil de oír mal.
 */
export function primerHuecoCuenta(p: CuentaPrellenada): CampoCuenta {
  if ((p.nombre ?? '').trim() === '') return 'nombre';
  return 'saldo';
}

export interface OpcionesFormularioCuenta {
  /** Recibe el id de la cuenta nueva y el nombre como quedó guardado. */
  alGuardar: (cuentaId: string, nombre: string) => void;
  /** Prefijo de los testID: `<testID>-tipo-<tipo>`, `-nombre`, `-saldo`, `-ultimos4`. */
  testID: string;
  prellenado?: CuentaPrellenada;
  /** Campo que recibe el foco al montar (el primer dato que falta, `primerHuecoCuenta`). */
  enfocar?: CampoCuenta;
}

export interface FormularioCuentaListo {
  /** Tipo, nombre, saldo de hoy (dictable, $0 vale) y últimos 4 (opcional). */
  campos: ReactNode;
  /** Valida, guarda con `agregarCuenta` y avisa con `alGuardar`; si falta algo, deja el error (anunciado). */
  guardar: () => void;
  error: string | null;
}

/**
 * El alta de una cuenta de débito, billetera o ahorro (una sola para O4 y Cuentas › «Agregar cuenta»): estado,
 * campos y guardado. Quien la usa decide dónde va el botón: dentro de la tarjeta (`FormularioCuenta`, O4) o en el pie
 * de la pantalla (`PantallaNuevaCuenta`), que sube con el teclado del iPhone. El saldo se guarda como saldo inicial
 * de hoy en servicios.
 */
export function useFormularioCuenta({
  alGuardar,
  testID,
  prellenado,
  enfocar,
}: OpcionesFormularioCuenta): FormularioCuentaListo {
  const { ctx, refrescar } = useSesion();
  const [tipo, setTipo] = useState<TipoCuenta>(prellenado?.tipo ?? 'debito');
  const [nombre, setNombre] = useState(prellenado?.nombre ?? '');
  const [saldo, setSaldo] = useState<Centavos | null>(prellenado?.saldo ?? null);
  const [ultimos4, setUltimos4] = useState(prellenado?.ultimos4 ?? '');
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
    let id: string;
    try {
      id = agregarCuenta(ctx, { subtipo: tipo, nombre: limpio, saldo, ...(u4 ? { ultimos4: u4 } : {}) });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    setErrorBase(null);
    refrescar();
    alGuardar(id, limpio);
  };

  const campos = (
    <>
      <Chips
        testID={`${testID}-tipo`}
        etiqueta={ETIQUETA_TIPO_CUENTA}
        opciones={OPCIONES_TIPO}
        valor={tipo}
        alCambiar={setTipo}
      />
      <CampoTexto
        testID={`${testID}-nombre`}
        etiqueta={ETIQUETA_NOMBRE_CUENTA}
        ejemplo={EJEMPLOS_NOMBRE_CUENTA[tipo]}
        valor={nombre}
        alCambiar={setNombre}
        autoFocus={enfocar === 'nombre'}
        nativo={{ maxLength: 60, autoCapitalize: 'words' }}
      />
      <CampoMonto
        testID={`${testID}-saldo`}
        etiqueta={ETIQUETA_SALDO_CUENTA}
        ayuda={AYUDA_SALDO_CUENTA}
        valorInicial={prellenado?.saldo ?? null}
        alCambiar={setSaldo}
        autoFocus={enfocar === 'saldo'}
        admiteCero
      />
      <CampoTexto
        testID={`${testID}-ultimos4`}
        etiqueta={ETIQUETA_ULTIMOS4}
        ayuda={AYUDA_ULTIMOS4}
        ejemplo="1234"
        teclado="number-pad"
        valor={ultimos4}
        alCambiar={setUltimos4}
        autoFocus={enfocar === 'ultimos4'}
        nativo={{ maxLength: 4 }}
      />
    </>
  );
  return { campos, guardar, error };
}

/**
 * El alta de cuenta en una tarjeta con «Agregar cuenta» (y «Cancelar» si se da `alCancelar`): O4 la abre debajo de
 * la lista. Para volver a llenarla con otro `prellenado`, quien la usa la monta de nuevo con `key`.
 */
export function FormularioCuenta({
  alGuardar,
  alCancelar,
  testID = 'onb-cuenta',
  prellenado,
  enfocar,
}: {
  alGuardar: (cuentaId: string, nombre: string) => void;
  alCancelar?: () => void;
  testID?: string;
  prellenado?: CuentaPrellenada;
  /** Campo que recibe el foco al montar. */
  enfocar?: CampoCuenta;
}) {
  const f = useFormularioCuenta({
    alGuardar,
    testID,
    ...(prellenado ? { prellenado } : {}),
    ...(enfocar ? { enfocar } : {}),
  });
  return (
    <Tarjeta testID={`${testID}-formulario`}>
      {f.campos}
      <Boton
        testID={`${testID}-agregar`}
        etiqueta={BTN_AGREGAR_CUENTA}
        pista={PISTA_AGREGAR_CUENTA_FORMULARIO}
        alPresionar={f.guardar}
      />
      {alCancelar ? (
        <Boton
          testID={`${testID}-cancelar`}
          variante="texto"
          etiqueta={BTN_CANCELAR}
          pista={PISTA_CANCELAR_CUENTA}
          alPresionar={alCancelar}
        />
      ) : null}
      <MensajeError texto={f.error} />
    </Tarjeta>
  );
}
