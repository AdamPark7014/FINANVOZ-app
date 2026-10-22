import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { agregarPagoFijo, listarCuentas, PAGOS_FIJOS_SUGERIDOS } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, Pantalla, Tarjeta } from '../../ui';
import { Casilla, Chips, type OpcionChip } from '../onboarding/componentes';
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
import { conAnuncio, Encabezado, MensajeEnLinea } from './Encabezado';
import {
  AYUDA_PAGO_RESTANTES,
  AYUDA_PAGO_VARIABLE,
  BTN_PAGO_MAS_OPCIONES,
  BTN_PAGO_MENOS_OPCIONES,
  CASILLA_PAGO_VARIABLE,
  CHIP_PAGO_CUENTA_DESPUES,
  CHIP_PAGO_OTRO,
  confirmacionPagoAgregado,
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
  TITULO_NUEVO_PAGO,
} from './textos';

type Clave = (typeof PAGOS_FIJOS_SUGERIDOS)[number]['clave'] | 'otro';

const CHIPS: readonly OpcionChip<Clave>[] = [
  ...PAGOS_FIJOS_SUGERIDOS.map((p) => ({ valor: p.clave as Clave, etiqueta: capitalizar(p.concepto) })),
  { valor: 'otro', etiqueta: CHIP_PAGO_OTRO },
];

const CUENTA_DESPUES = 'despues';

/**
 * Cuentas › Compromisos › Agregar pago fijo (`02 §11`): el formulario de O5 después del onboarding (chips
 * sugeridos u «Otro», nombre, cada cuándo, monto, si cambia cada vez y, bajo «Más opciones», de qué cuenta sale y
 * cuántos pagos faltan). La traducción a regla es la de O5 (`onboarding/pagos-fijos.ts`); guardar usa
 * `agregarPagoFijo` y regresa a Cuentas.
 */
export function PantallaNuevoPagoFijo({
  alVolver,
  alGuardar,
}: {
  alVolver: () => void;
  /** Recibe la confirmación ya redactada («Listo: agregué renta. Ya lo aparto.»). */
  alGuardar: (confirmacion: string) => void;
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
  const [error, setErrorBase] = useState<string | null>(null);
  const setError = conAnuncio(setErrorBase);
  // Cambia con cada chip: así el monto (campo no controlado) vuelve a empezar vacío.
  const [formulario, setFormulario] = useState(0);
  const sugerido = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === clave) ?? null;

  const opcionesCuenta: readonly OpcionChip<string>[] = [
    { valor: CUENTA_DESPUES, etiqueta: CHIP_PAGO_CUENTA_DESPUES },
    ...cuentas.tienes.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
    ...cuentas.debes.filter((d) => d.tipo === 'tarjeta').map((d) => ({ valor: d.id, etiqueta: d.nombre })),
  ];

  const elegir = (siguiente: Clave) => {
    const s = PAGOS_FIJOS_SUGERIDOS.find((p) => p.clave === siguiente) ?? null;
    setClave(siguiente);
    setNombre(s ? capitalizar(s.concepto) : '');
    setVariable(s?.variable ?? false);
    setRespuestas(RESPUESTAS_PAGO_INICIALES);
    setMonto(null);
    setCuentaId(null);
    setMasOpciones(false);
    setErrorBase(null);
    setFormulario((n) => n + 1);
  };

  const guardar = () => {
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
    // Igual que en O5: si dejó el nombre del chip tal cual, se guarda el concepto del catálogo («¿Ya pagaste la
    // luz?»); si lo cambió («Netflix»), como lo escribió.
    const conceptoGuardado =
      sugerido && concepto === capitalizar(sugerido.concepto) ? sugerido.concepto : concepto;
    try {
      agregarPagoFijo(ctx, {
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
    setErrorBase(null);
    refrescar();
    alGuardar(confirmacionPagoAgregado(conceptoGuardado));
  };

  const pideDiaMes = respuestas.frecuencia === 'mensual' || respuestas.frecuencia === 'anual';
  const etiquetaGuardar = etiquetaGuardarPago(limpiarNombrePago(nombre) ?? sugerido?.concepto ?? 'pago');

  return (
    <Pantalla
      testID="pago-nuevo"
      bordes={['top', 'left', 'right', 'bottom']}
      {...(clave !== null
        ? {
            pie: (
              <Boton
                testID="pago-nuevo-guardar"
                etiqueta={etiquetaGuardar}
                pista={PISTA_GUARDAR_PAGO}
                alPresionar={guardar}
              />
            ),
          }
        : {})}
    >
      <Encabezado titulo={TITULO_NUEVO_PAGO} alVolver={alVolver} testID="pago-nuevo" />
      <Chips
        testID="pago-nuevo-tipo"
        etiqueta={PREGUNTA_PAGO}
        opciones={CHIPS}
        valor={clave}
        alCambiar={elegir}
      />
      {clave !== null ? (
        <Tarjeta key={`${clave}-${formulario}`} testID="pago-nuevo-formulario">
          <CampoTexto
            testID="pago-nuevo-nombre"
            etiqueta={ETIQUETA_PAGO_NOMBRE}
            ejemplo={EJEMPLO_PAGO_NOMBRE}
            valor={nombre}
            alCambiar={setNombre}
            autoFocus={clave === 'otro'}
            nativo={{ maxLength: 60 }}
          />
          <Chips
            testID="pago-nuevo-frecuencia"
            etiqueta={ETIQUETA_PAGO_FRECUENCIA}
            opciones={OPCIONES_FRECUENCIA_PAGO}
            valor={respuestas.frecuencia}
            alCambiar={(frecuencia) => setRespuestas((r) => ({ ...r, frecuencia }))}
          />
          {respuestas.frecuencia === 'semanal' ? (
            <Chips
              testID="pago-nuevo-dia-semana"
              etiqueta={ETIQUETA_PAGO_DIA_SEMANA}
              opciones={OPCIONES_DIA_SEMANA}
              valor={respuestas.diaSemana}
              alCambiar={(diaSemana) => setRespuestas((r) => ({ ...r, diaSemana }))}
            />
          ) : null}
          {respuestas.frecuencia === 'anual' ? (
            <Chips
              testID="pago-nuevo-mes"
              etiqueta={ETIQUETA_PAGO_MES}
              opciones={OPCIONES_MES}
              valor={respuestas.mes}
              alCambiar={(mes) => setRespuestas((r) => ({ ...r, mes }))}
            />
          ) : null}
          {pideDiaMes ? (
            <CampoTexto
              testID="pago-nuevo-dia"
              etiqueta={ETIQUETA_PAGO_DIA_MES}
              ejemplo="5"
              teclado="number-pad"
              valor={respuestas.diaMes}
              alCambiar={(diaMes) => setRespuestas((r) => ({ ...r, diaMes }))}
              nativo={{ maxLength: 2 }}
            />
          ) : null}
          <CampoMonto
            testID="pago-nuevo-monto"
            etiqueta={variable ? ETIQUETA_PAGO_MONTO_VARIABLE : ETIQUETA_PAGO_MONTO_FIJO}
            {...(variable ? { ayuda: AYUDA_PAGO_VARIABLE } : {})}
            alCambiar={setMonto}
          />
          <Casilla
            testID="pago-nuevo-variable"
            etiqueta={CASILLA_PAGO_VARIABLE}
            valor={variable}
            alCambiar={setVariable}
          />
          <Boton
            testID="pago-nuevo-mas-opciones"
            variante="secundario"
            ancho="contenido"
            etiqueta={masOpciones ? BTN_PAGO_MENOS_OPCIONES : BTN_PAGO_MAS_OPCIONES}
            pista={masOpciones ? PISTA_PAGO_MENOS_OPCIONES : PISTA_PAGO_MAS_OPCIONES}
            alPresionar={() => setMasOpciones((v) => !v)}
          />
          {masOpciones ? (
            <>
              <Chips
                testID="pago-nuevo-cuenta"
                etiqueta={ETIQUETA_PAGO_CUENTA}
                opciones={opcionesCuenta}
                valor={cuentaId ?? CUENTA_DESPUES}
                alCambiar={(v) => setCuentaId(v === CUENTA_DESPUES ? null : v)}
              />
              <CampoTexto
                testID="pago-nuevo-restantes"
                etiqueta={ETIQUETA_PAGO_RESTANTES}
                ayuda={AYUDA_PAGO_RESTANTES}
                ejemplo="12"
                teclado="number-pad"
                valor={respuestas.pagosRestantes}
                alCambiar={(pagosRestantes) => setRespuestas((r) => ({ ...r, pagosRestantes }))}
                nativo={{ maxLength: 3 }}
              />
            </>
          ) : null}
        </Tarjeta>
      ) : null}
      <MensajeEnLinea texto={error} error testID="pago-nuevo-error" />
    </Pantalla>
  );
}
