import type { Centavos, PlainDate, Regla } from '@cartera/core';
import { interpretarPagoFijoDicho } from '@cartera/nlu';
import { useState } from 'react';
import { agregarPagoFijo, listarCuentas, PAGOS_FIJOS_SUGERIDOS } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Tarjeta } from '../../ui';
import { DecirloPaso } from '../onboarding/DecirloPaso';
import { Casilla, Chips, ERROR_GUARDAR, MensajeError, type OpcionChip } from '../onboarding/componentes';
import { OPCIONES_DIA_SEMANA } from '../onboarding/ingreso';
import {
  capitalizar,
  hastaDePago,
  leerPagosRestantes,
  limpiarNombrePago,
  OPCIONES_FRECUENCIA_PAGO,
  OPCIONES_MES,
  reglaDePago,
  respuestasDePagoDicho,
  RESPUESTAS_PAGO_INICIALES,
  type RespuestasPago,
} from '../onboarding/pagos-fijos';
import {
  AYUDA_PAGO_RESTANTES,
  AYUDA_PAGO_VARIABLE,
  BTN_PAGO_MAS_OPCIONES,
  BTN_PAGO_MENOS_OPCIONES,
  CASILLA_PAGO_VARIABLE,
  CHIP_PAGO_CUENTA_DESPUES,
  CHIP_PAGO_OTRO,
  EJEMPLO_PAGO_NOMBRE,
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
  etiquetaAgregarPago,
  PISTA_PAGO_MAS_OPCIONES,
  PISTA_PAGO_MENOS_OPCIONES,
} from '../onboarding/textos';

type Clave = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'] | 'otro';

const CHIPS: readonly OpcionChip<Clave>[] = [
  ...PAGOS_FIJOS_SUGERIDOS.map((p) => ({ valor: p.clave as Clave, etiqueta: capitalizar(p.concepto) })),
  { valor: 'otro', etiqueta: CHIP_PAGO_OTRO },
];

const CUENTA_DESPUES = 'despues';

/** Un pago fijo recién guardado, como lo muestra la lista de O5. */
export interface PagoAgregado {
  id: string;
  concepto: string;
  monto: Centavos;
  regla: Regla;
  /** Nombre de la cuenta de la que sale, o `null` si se decide después. */
  cuenta: string | null;
  hasta: PlainDate | null;
}

/**
 * Alta de un pago fijo (O5 y Cuentas › «Agregar pago fijo»): «O dímelo», chips sugeridos u «Otro» → nombre, cada
 * cuándo, monto, si cambia cada vez y, bajo «Más opciones», de qué cuenta sale y cuántos pagos faltan. Después de
 * cada alta el formulario vuelve a empezar y avisa con `alAgregado`.
 */
export function FormularioPagoFijo({
  alAgregado,
  testID = 'onb-pago',
}: {
  alAgregado: (pago: PagoAgregado) => void;
  testID?: string;
}) {
  const { ctx, refrescar } = useSesion();
  const cuentas = useVista(listarCuentas);
  const [clave, setClave] = useState<Clave | null>(null);
  const [nombre, setNombre] = useState('');
  const [respuestas, setRespuestas] = useState<RespuestasPago>(RESPUESTAS_PAGO_INICIALES);
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [variable, setVariable] = useState(false);
  const [masOpciones, setMasOpciones] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cambia con cada chip y cada alta: así los campos no controlados (monto) vuelven a empezar vacíos.
  const [formulario, setFormulario] = useState(0);
  const sugerido = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === clave) ?? null;

  const opcionesCuenta: readonly OpcionChip<string>[] = [
    { valor: CUENTA_DESPUES, etiqueta: CHIP_PAGO_CUENTA_DESPUES },
    ...cuentas.tienes.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    ...cuentas.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ valor: d.id, etiqueta: d.nombre })),
  ];

  const reiniciar = (siguiente: Clave | null) => {
    const s = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === siguiente) ?? null;
    setClave(siguiente);
    setNombre(s ? capitalizar(s.concepto) : '');
    setVariable(s?.variable ?? false);
    setRespuestas(RESPUESTAS_PAGO_INICIALES);
    setMonto(null);
    setCuentaId(null);
    setMasOpciones(false);
    setError(null);
    setFormulario((n) => n + 1);
  };

  const agregar = () => {
    if (clave === null) return;
    const concepto = limpiarNombrePago(nombre);
    if (!concepto) {
      setError(ERROR_PAGO_NOMBRE);
      return;
    }
    const regla = reglaDePago(respuestas);
    if (monto === null || monto <= 0 || regla === null) {
      setError(ERROR_PAGO_FIJO_INCOMPLETO);
      return;
    }
    const restantes = leerPagosRestantes(respuestas.pagosRestantes);
    if (restantes === undefined) {
      setError(ERROR_PAGO_RESTANTES);
      return;
    }
    const hasta = restantes === null ? null : hastaDePago(regla, ctx.reloj.hoy(), restantes);
    // Si la persona dejó el nombre del chip tal cual, se guarda el concepto del catálogo (minúsculas, como
    // antes: «¿Ya pagaste la luz?»); si lo cambió («Netflix»), se guarda como lo escribió.
    const conceptoGuardado =
      sugerido && concepto === capitalizar(sugerido.concepto) ? sugerido.concepto : concepto;
    let id: string;
    try {
      id = agregarPagoFijo(ctx, {
        concepto: conceptoGuardado,
        monto,
        regla,
        categoria: sugerido?.categoria ?? null,
        cuentaId,
        variable,
        hasta,
      });
    } catch {
      setError(ERROR_GUARDAR);
      return;
    }
    const cuenta = cuentaId ? (opcionesCuenta.find((o) => o.valor === cuentaId)?.etiqueta ?? null) : null;
    reiniciar(null);
    refrescar();
    alAgregado({ id, concepto, monto, regla, cuenta, hasta });
  };

  const pideDiaMes = respuestas.frecuencia === 'mensual' || respuestas.frecuencia === 'anual';
  const etiquetaAgregar = etiquetaAgregarPago(limpiarNombrePago(nombre) ?? sugerido?.concepto ?? 'pago');

  return (
    <>
      <DecirloPaso
        testID={`${testID}-decir`}
        ejemplo="pago 4500 de renta cada mes el 5"
        interpretar={interpretarPagoFijoDicho}
        alEntender={(d) => {
          const r = respuestasDePagoDicho(d, PAGOS_FIJOS_SUGERIDOS);
          // Igual que tocar el chip (nombre, «cambia cada vez», campos nuevos) y luego lo dicho encima.
          reiniciar(r.clave);
          setNombre(r.nombre);
          setRespuestas(r.respuestas);
          setMonto(r.monto);
        }}
      />
      <Chips testID={testID} opciones={CHIPS} valor={clave} alCambiar={reiniciar} />
      {clave !== null ? (
        <Tarjeta key={`${clave}-${formulario}`} testID={`${testID}-formulario`}>
          <CampoTexto
            testID={`${testID}-nombre`}
            etiqueta={ETIQUETA_PAGO_NOMBRE}
            ejemplo={EJEMPLO_PAGO_NOMBRE}
            valor={nombre}
            alCambiar={setNombre}
            autoFocus={clave === 'otro'}
          />
          <Chips
            testID={`${testID}-frecuencia`}
            etiqueta={ETIQUETA_PAGO_FRECUENCIA}
            opciones={OPCIONES_FRECUENCIA_PAGO}
            valor={respuestas.frecuencia}
            alCambiar={(frecuencia) => setRespuestas((r) => ({ ...r, frecuencia }))}
          />
          {respuestas.frecuencia === 'semanal' ? (
            <Chips
              testID={`${testID}-dia-semana`}
              etiqueta={ETIQUETA_PAGO_DIA_SEMANA}
              opciones={OPCIONES_DIA_SEMANA}
              valor={respuestas.diaSemana}
              alCambiar={(diaSemana) => setRespuestas((r) => ({ ...r, diaSemana }))}
            />
          ) : null}
          {respuestas.frecuencia === 'anual' ? (
            <Chips
              testID={`${testID}-mes`}
              etiqueta={ETIQUETA_PAGO_MES}
              opciones={OPCIONES_MES}
              valor={respuestas.mes}
              alCambiar={(mes) => setRespuestas((r) => ({ ...r, mes }))}
            />
          ) : null}
          {pideDiaMes ? (
            <CampoTexto
              testID={`${testID}-dia`}
              etiqueta={ETIQUETA_PAGO_DIA_MES}
              ejemplo="5"
              teclado="number-pad"
              valor={respuestas.diaMes}
              alCambiar={(diaMes) => setRespuestas((r) => ({ ...r, diaMes }))}
            />
          ) : null}
          <CampoMonto
            testID={`${testID}-monto`}
            etiqueta={variable ? ETIQUETA_PAGO_MONTO_VARIABLE : ETIQUETA_PAGO_MONTO_FIJO}
            {...(variable ? { ayuda: AYUDA_PAGO_VARIABLE } : {})}
            valorInicial={monto}
            alCambiar={setMonto}
          />
          <Casilla
            testID={`${testID}-variable`}
            etiqueta={CASILLA_PAGO_VARIABLE}
            valor={variable}
            alCambiar={setVariable}
          />
          <Boton
            testID={`${testID}-mas-opciones`}
            variante="secundario"
            ancho="contenido"
            etiqueta={masOpciones ? BTN_PAGO_MENOS_OPCIONES : BTN_PAGO_MAS_OPCIONES}
            pista={masOpciones ? PISTA_PAGO_MENOS_OPCIONES : PISTA_PAGO_MAS_OPCIONES}
            alPresionar={() => setMasOpciones((v) => !v)}
          />
          {masOpciones ? (
            <>
              <Chips
                testID={`${testID}-cuenta`}
                etiqueta={ETIQUETA_PAGO_CUENTA}
                opciones={opcionesCuenta}
                valor={cuentaId ?? CUENTA_DESPUES}
                alCambiar={(v) => setCuentaId(v === CUENTA_DESPUES ? null : v)}
              />
              <CampoTexto
                testID={`${testID}-restantes`}
                etiqueta={ETIQUETA_PAGO_RESTANTES}
                ayuda={AYUDA_PAGO_RESTANTES}
                ejemplo="12"
                teclado="number-pad"
                valor={respuestas.pagosRestantes}
                alCambiar={(pagosRestantes) => setRespuestas((r) => ({ ...r, pagosRestantes }))}
              />
            </>
          ) : null}
          <Boton testID={`${testID}-agregar`} etiqueta={etiquetaAgregar} alPresionar={agregar} />
        </Tarjeta>
      ) : null}
      <MensajeError texto={error} />
    </>
  );
}
