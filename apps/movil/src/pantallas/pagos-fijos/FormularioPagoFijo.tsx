import type { Centavos, PlainDate, Regla } from '@cartera/core';
import { interpretarPaso } from '@cartera/nlu';
import { useState, type ReactNode } from 'react';
import { agregarPagoFijo, listarCuentas, PAGOS_FIJOS_SUGERIDOS } from '../../servicios';
import { contextoInterprete } from '../../servicios/registrar';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta } from '../../ui';
import { conAnuncio } from '../cuentas/Encabezado';
import {
  AYUDA_PAGO_RESTANTES,
  AYUDA_PAGO_VARIABLE,
  BTN_PAGO_MAS_OPCIONES,
  BTN_PAGO_MENOS_OPCIONES,
  CASILLA_PAGO_VARIABLE,
  CHIP_PAGO_CUENTA_DESPUES,
  CHIP_PAGO_OTRO,
  EJEMPLO_DECIR_PAGO,
  EJEMPLO_PAGO_NOMBRE,
  ERROR_GUARDAR,
  ERROR_PAGO_FIJO_INCOMPLETO,
  ERROR_PAGO_NOMBRE,
  ERROR_PAGO_RESTANTES,
  ETIQUETA_PAGO_CUENTA,
  ETIQUETA_PAGO_DIA_MES,
  ETIQUETA_PAGO_DIA_SEMANA,
  ETIQUETA_PAGO_FRECUENCIA,
  ETIQUETA_PAGO_MES,
  ETIQUETA_PAGO_MONTO_FIJO,
  ETIQUETA_PAGO_MONTO_VARIABLE,
  ETIQUETA_PAGO_NOMBRE,
  ETIQUETA_PAGO_RESTANTES,
  etiquetaGuardarPago,
  PISTA_GUARDAR_PAGO,
  PISTA_PAGO_MAS_OPCIONES,
  PISTA_PAGO_MENOS_OPCIONES,
  PREGUNTA_PAGO,
} from '../cuentas/textos';
import { DecirloPaso } from '../onboarding/DecirloPaso';
import { Casilla, Chips, MensajeError, type OpcionChip } from '../onboarding/componentes';
import { OPCIONES_DIA_SEMANA } from '../onboarding/ingreso';
import {
  capitalizar,
  hastaDePago,
  leerPagosRestantes,
  limpiarNombrePago,
  OPCIONES_FRECUENCIA_PAGO,
  OPCIONES_MES,
  reglaDePago,
  RESPUESTAS_PAGO_INICIALES,
  type RespuestasPago,
} from '../onboarding/pagos-fijos';
import { prellenadoDePagoLeido, type PagoPrellenado } from './prellenado';

type ClaveSugerida = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'];
type Clave = ClaveSugerida | 'otro';

/** Lo que llena el formulario antes de revisarlo (lo dicho en «O dímelo» o en el asistente). */
export type PagoFijoPrellenado = PagoPrellenado<ClaveSugerida>;

const CHIPS: readonly OpcionChip<Clave>[] = [
  ...PAGOS_FIJOS_SUGERIDOS.map((p) => ({ valor: p.clave as Clave, etiqueta: capitalizar(p.concepto) })),
  { valor: 'otro', etiqueta: CHIP_PAGO_OTRO },
];

const CUENTA_DESPUES = 'despues';

/** Un pago fijo recién guardado, como lo muestra la lista de O5. */
export interface PagoAgregado {
  id: string;
  /** Como lo escribió o lo dejó la persona («Renta», «Netflix»). */
  concepto: string;
  /** Como quedó guardado: el concepto del catálogo en minúsculas si no se cambió el del chip («renta»). */
  conceptoGuardado: string;
  monto: Centavos;
  regla: Regla;
  /** Nombre de la cuenta de la que sale, o `null` si se decide después. */
  cuenta: string | null;
  hasta: PlainDate | null;
}

interface Campos {
  clave: Clave | null;
  nombre: string;
  respuestas: RespuestasPago;
  monto: Centavos | null;
  variable: boolean;
  cuentaId: string | null;
  masOpciones: boolean;
}

const sugeridoDe = (clave: Clave | null) => PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === clave) ?? null;

/** Lo que muestra el formulario al elegir un chip (o al llegar algo dicho, que se pone encima). */
function camposDe(clave: Clave | null, p?: PagoFijoPrellenado): Campos {
  const s = sugeridoDe(clave);
  return {
    clave,
    nombre: p?.nombre ?? (s ? capitalizar(s.concepto) : ''),
    respuestas: p?.respuestas ?? RESPUESTAS_PAGO_INICIALES,
    monto: p?.monto ?? null,
    variable: s?.variable ?? false,
    cuentaId: p?.cuentaId ?? null,
    // Si se dijo de qué cuenta sale o cuántos pagos faltan, se ve sin tocar «Más opciones».
    masOpciones: p !== undefined && (p.cuentaId !== null || p.respuestas.pagosRestantes !== ''),
  };
}

/** Campos que pueden recibir el foco (los chips de frecuencia, día de la semana y mes se tocan, no se escriben). */
export type CampoPagoFijo = 'nombre' | 'dia' | 'monto';

/**
 * El primer dato que falta en lo dicho, para llevar ahí el foco al llenar el formulario (Ola 7 §7: O5 incompleto
 * llena el formulario y lleva el foco al primer hueco). `null` si no falta nada que se escriba.
 */
export function primerHuecoPago(p: PagoFijoPrellenado): CampoPagoFijo | null {
  if (p.nombre.trim() === '') return 'nombre';
  const r = p.respuestas;
  if ((r.frecuencia === 'mensual' || r.frecuencia === 'anual') && r.diaMes.trim() === '') return 'dia';
  if (p.monto === null) return 'monto';
  return null;
}

export interface OpcionesFormularioPagoFijo {
  alAgregado: (pago: PagoAgregado) => void;
  /** Prefijo de los testID: chips `<testID>-<clave>`, `-nombre`, `-frecuencia-*`, `-monto`, `-restantes`… */
  testID: string;
  /** Llena el formulario al abrir; para volver a llenarlo, quien lo usa lo monta de nuevo con `key`. */
  prellenado?: PagoFijoPrellenado;
  /** «O dímelo» arriba de los chips (por omisión, sí); sin dictado en el teléfono no aparece. */
  conDecirlo?: boolean;
  /** Campo que recibe el foco al abrir con `prellenado` (el primer dato que falta, `primerHuecoPago`). */
  enfocar?: CampoPagoFijo;
}

export interface FormularioPagoFijoListo {
  /** «O dímelo» y los chips sugeridos u «Otro». */
  encabezado: ReactNode;
  /** El chip elegido; `null` mientras no se elige (no hay campos ni botón). */
  clave: Clave | null;
  /** Llave de la tarjeta de campos: cambia con cada chip y cada alta para que el monto empiece de nuevo. */
  llave: string;
  /** Nombre, cada cuándo, monto, si cambia cada vez y, bajo «Más opciones», cuenta de salida y pagos que faltan. */
  campos: ReactNode;
  /** «Agregar renta». */
  etiquetaAgregar: string;
  /** Valida, guarda con `agregarPagoFijo`, avisa con `alAgregado` y vuelve a empezar. */
  agregar: () => void;
  error: string | null;
}

/**
 * El alta de un pago fijo (una sola para O5 y Cuentas › «Agregar pago fijo»): «O dímelo», chips sugeridos u «Otro» →
 * nombre editable, cada cuándo, monto (dictable), si cambia cada vez y, bajo «Más opciones», de qué cuenta sale y
 * cuántos pagos faltan. La traducción a regla es la de O5 (`onboarding/pagos-fijos.ts`). Quien la usa decide dónde
 * va el botón: en la tarjeta (`FormularioPagoFijo`, O5) o en el pie de la pantalla (`PantallaNuevoPagoFijo`).
 */
export function useFormularioPagoFijo({
  alAgregado,
  testID,
  prellenado,
  conDecirlo = true,
  enfocar,
}: OpcionesFormularioPagoFijo): FormularioPagoFijoListo {
  const { ctx, refrescar } = useSesion();
  const cuentas = useVista(listarCuentas);
  const [f, setF] = useState<Campos>(() =>
    prellenado ? camposDe(prellenado.clave, prellenado) : camposDe(null),
  );
  const [error, setErrorBase] = useState<string | null>(null);
  const setError = conAnuncio(setErrorBase);
  // El foco va al primer hueco de lo dicho; tocar un chip lo suelta (la persona eligió otra cosa).
  const [foco, setFoco] = useState<CampoPagoFijo | null>(prellenado ? (enfocar ?? null) : null);
  // Cambia con cada chip y cada alta: así los campos no controlados (monto) vuelven a empezar.
  const [formulario, setFormulario] = useState(0);
  const sugerido = sugeridoDe(f.clave);
  const poner = (cambios: Partial<Campos>) => setF((v) => ({ ...v, ...cambios }));
  const responder = (cambios: Partial<RespuestasPago>) =>
    setF((v) => ({ ...v, respuestas: { ...v.respuestas, ...cambios } }));

  const salidas = [
    ...cuentas.tienes.map((c) => ({ id: c.id, nombre: c.nombre })),
    ...cuentas.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ id: d.id, nombre: d.nombre })),
  ];
  const opcionesCuenta: readonly OpcionChip<string>[] = [
    { valor: CUENTA_DESPUES, etiqueta: CHIP_PAGO_CUENTA_DESPUES },
    ...salidas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  const reiniciar = (siguiente: Clave | null, p?: PagoFijoPrellenado) => {
    setF(camposDe(siguiente, p));
    setFoco(p ? primerHuecoPago(p) : null);
    setErrorBase(null);
    setFormulario((n) => n + 1);
  };

  /** «O dímelo»: un pago a la vez (una frase larga mal partida no crea pagos equivocados). */
  const interpretar = (texto: string): PagoFijoPrellenado | null => {
    const l = interpretarPaso('pagos_fijos', texto, contextoInterprete(ctx));
    const pago = l?.paso === 'pagos_fijos' && l.pagos.length === 1 ? l.pagos[0] : undefined;
    return pago ? prellenadoDePagoLeido(pago, PAGOS_FIJOS_SUGERIDOS, salidas) : null;
  };

  const agregar = () => {
    if (f.clave === null) return;
    const concepto = limpiarNombrePago(f.nombre);
    if (!concepto) {
      setError(ERROR_PAGO_NOMBRE);
      return;
    }
    const regla = reglaDePago(f.respuestas);
    if (f.monto === null || f.monto <= 0 || regla === null) {
      setError(ERROR_PAGO_FIJO_INCOMPLETO);
      return;
    }
    const restantes = leerPagosRestantes(f.respuestas.pagosRestantes);
    if (restantes === undefined) {
      setError(ERROR_PAGO_RESTANTES);
      return;
    }
    const hasta = restantes === null ? null : hastaDePago(regla, ctx.reloj.hoy(), restantes);
    // Si la persona dejó el nombre del chip tal cual, se guarda el concepto del catálogo (minúsculas: «¿Ya pagaste
    // la luz?»); si lo cambió («Netflix»), se guarda como lo escribió.
    const conceptoGuardado =
      sugerido && concepto === capitalizar(sugerido.concepto) ? sugerido.concepto : concepto;
    let id: string;
    try {
      id = agregarPagoFijo(ctx, {
        concepto: conceptoGuardado,
        monto: f.monto,
        regla,
        categoria: sugerido?.categoria ?? null,
        cuentaId: f.cuentaId,
        variable: f.variable,
        hasta,
      });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    const cuenta = f.cuentaId ? (salidas.find((c) => c.id === f.cuentaId)?.nombre ?? null) : null;
    const monto = f.monto;
    reiniciar(null);
    refrescar();
    alAgregado({ id, concepto, conceptoGuardado, monto, regla, cuenta, hasta });
  };

  const pideDiaMes = f.respuestas.frecuencia === 'mensual' || f.respuestas.frecuencia === 'anual';

  const encabezado = (
    <>
      {conDecirlo ? (
        <DecirloPaso
          testID={`${testID}-decir`}
          ejemplo={EJEMPLO_DECIR_PAGO}
          interpretar={interpretar}
          alEntender={(p) => reiniciar(p.clave, p)}
        />
      ) : null}
      <Chips
        testID={testID}
        etiqueta={PREGUNTA_PAGO}
        opciones={CHIPS}
        valor={f.clave}
        alCambiar={(clave) => reiniciar(clave)}
      />
    </>
  );

  const campos =
    f.clave === null ? null : (
      <>
        <CampoTexto
          testID={`${testID}-nombre`}
          etiqueta={ETIQUETA_PAGO_NOMBRE}
          ejemplo={EJEMPLO_PAGO_NOMBRE}
          valor={f.nombre}
          alCambiar={(nombre) => poner({ nombre })}
          autoFocus={foco === 'nombre' || (f.clave === 'otro' && f.nombre === '')}
          nativo={{ maxLength: 60 }}
        />
        <Chips
          testID={`${testID}-frecuencia`}
          etiqueta={ETIQUETA_PAGO_FRECUENCIA}
          opciones={OPCIONES_FRECUENCIA_PAGO}
          valor={f.respuestas.frecuencia}
          alCambiar={(frecuencia) => responder({ frecuencia })}
        />
        {f.respuestas.frecuencia === 'semanal' ? (
          <Chips
            testID={`${testID}-dia-semana`}
            etiqueta={ETIQUETA_PAGO_DIA_SEMANA}
            opciones={OPCIONES_DIA_SEMANA}
            valor={f.respuestas.diaSemana}
            alCambiar={(diaSemana) => responder({ diaSemana })}
          />
        ) : null}
        {f.respuestas.frecuencia === 'anual' ? (
          <Chips
            testID={`${testID}-mes`}
            etiqueta={ETIQUETA_PAGO_MES}
            opciones={OPCIONES_MES}
            valor={f.respuestas.mes}
            alCambiar={(mes) => responder({ mes })}
          />
        ) : null}
        {pideDiaMes ? (
          <CampoTexto
            testID={`${testID}-dia`}
            etiqueta={ETIQUETA_PAGO_DIA_MES}
            ejemplo="5"
            teclado="number-pad"
            valor={f.respuestas.diaMes}
            alCambiar={(diaMes) => responder({ diaMes })}
            autoFocus={foco === 'dia'}
            nativo={{ maxLength: 2 }}
          />
        ) : null}
        <CampoMonto
          testID={`${testID}-monto`}
          etiqueta={f.variable ? ETIQUETA_PAGO_MONTO_VARIABLE : ETIQUETA_PAGO_MONTO_FIJO}
          {...(f.variable ? { ayuda: AYUDA_PAGO_VARIABLE } : {})}
          valorInicial={f.monto}
          alCambiar={(monto) => poner({ monto })}
          autoFocus={foco === 'monto'}
        />
        <Casilla
          testID={`${testID}-variable`}
          etiqueta={CASILLA_PAGO_VARIABLE}
          valor={f.variable}
          alCambiar={(variable) => poner({ variable })}
        />
        <Boton
          testID={`${testID}-mas-opciones`}
          variante="secundario"
          ancho="contenido"
          etiqueta={f.masOpciones ? BTN_PAGO_MENOS_OPCIONES : BTN_PAGO_MAS_OPCIONES}
          pista={f.masOpciones ? PISTA_PAGO_MENOS_OPCIONES : PISTA_PAGO_MAS_OPCIONES}
          alPresionar={() => poner({ masOpciones: !f.masOpciones })}
        />
        {f.masOpciones ? (
          <>
            <Chips
              testID={`${testID}-cuenta`}
              etiqueta={ETIQUETA_PAGO_CUENTA}
              opciones={opcionesCuenta}
              valor={f.cuentaId ?? CUENTA_DESPUES}
              alCambiar={(v) => poner({ cuentaId: v === CUENTA_DESPUES ? null : v })}
            />
            <CampoTexto
              testID={`${testID}-restantes`}
              etiqueta={ETIQUETA_PAGO_RESTANTES}
              ayuda={AYUDA_PAGO_RESTANTES}
              ejemplo="12"
              teclado="number-pad"
              valor={f.respuestas.pagosRestantes}
              alCambiar={(pagosRestantes) => responder({ pagosRestantes })}
              nativo={{ maxLength: 3 }}
            />
          </>
        ) : null}
      </>
    );

  return {
    encabezado,
    clave: f.clave,
    llave: `${f.clave ?? 'nada'}-${formulario}`,
    campos,
    etiquetaAgregar: etiquetaGuardarPago(limpiarNombrePago(f.nombre) ?? sugerido?.concepto ?? 'pago'),
    agregar,
    error,
  };
}

/**
 * El alta de un pago fijo con «Agregar …» dentro de la tarjeta (O5). Después de cada alta el formulario vuelve a
 * empezar y avisa con `alAgregado`.
 */
export function FormularioPagoFijo({
  alAgregado,
  testID = 'onb-pago',
  prellenado,
  conDecirlo,
  enfocar,
}: {
  alAgregado: (pago: PagoAgregado) => void;
  testID?: string;
  prellenado?: PagoFijoPrellenado;
  conDecirlo?: boolean;
  /** Campo que recibe el foco al abrir con `prellenado`. */
  enfocar?: CampoPagoFijo;
}) {
  const f = useFormularioPagoFijo({
    alAgregado,
    testID,
    ...(prellenado ? { prellenado } : {}),
    ...(conDecirlo === undefined ? {} : { conDecirlo }),
    ...(enfocar ? { enfocar } : {}),
  });
  return (
    <>
      {f.encabezado}
      {f.clave !== null ? (
        <Tarjeta key={f.llave} testID={`${testID}-formulario`}>
          {f.campos}
          <Boton
            testID={`${testID}-agregar`}
            etiqueta={f.etiquetaAgregar}
            pista={PISTA_GUARDAR_PAGO}
            alPresionar={f.agregar}
          />
        </Tarjeta>
      ) : null}
      <MensajeError texto={f.error} />
    </>
  );
}
