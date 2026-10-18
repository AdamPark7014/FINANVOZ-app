import { ErrorDominio, type PlainDate } from '@cartera/core';
import { useState } from 'react';
import {
  configurarIngreso,
  configurarIngresoVariable,
  etiquetaFecha,
  proximoPago,
  type Contexto,
} from '../../servicios';
import { CampoMonto, CampoTexto, Tarjeta, Texto } from '../../ui';
import { Chips } from '../onboarding/componentes';
import {
  conceptoIngreso,
  leerDiaMes,
  OPCIONES_DIA_SEMANA,
  OPCIONES_FIN_DE_SEMANA,
  OPCIONES_FRECUENCIA,
  proximos14Dias,
  reglaDeIngreso,
} from '../onboarding/ingreso';
import {
  AYUDA_MONTO,
  EJEMPLO_DIA_MES,
  ERROR_DIA_MES,
  ETIQUETA_PROXIMO_PAGO,
  PREGUNTA_DIA_MES,
  PREGUNTA_DIA_SEMANA,
  PREGUNTA_FIN_SEMANA,
  PREGUNTA_FRECUENCIA,
  PREGUNTA_MONTO,
  PREGUNTA_PROXIMA_VEZ,
  TEXTO_INGRESO_VARIABLE,
} from './ingreso-textos';
import { INGRESO_EN_BLANCO, type ValoresIngreso } from './ingreso';

/**
 * Las preguntas de O3 (`02 §3`) como formulario reutilizable: Ajustes › Ingreso lo usa para cambiar el ingreso con
 * el mismo mapeo (`reglaDeIngreso`) y los mismos servicios que el onboarding.
 */
export function useFormularioIngreso(
  hoy: PlainDate,
  inicial: ValoresIngreso | (() => ValoresIngreso) = INGRESO_EN_BLANCO,
) {
  const [valores, setValores] = useState(inicial);
  const cambiar = <K extends keyof ValoresIngreso>(campo: K, valor: ValoresIngreso[K]) =>
    setValores((v) => ({ ...v, [campo]: valor }));

  const variable = valores.frecuencia === 'varia';
  const regla = reglaDeIngreso({
    frecuencia: valores.frecuencia,
    finDeSemana: valores.finDeSemana,
    diaSemana: valores.diaSemana,
    ancla: valores.ancla,
    diaMes: leerDiaMes(valores.diaMesTexto),
  });
  const proximo = regla ? proximoPago(regla, hoy) : null;
  const monto = valores.monto;
  const completo = variable || (regla !== null && monto !== null && monto > 0);

  /** "Varía" → modo ingreso variable; si no, el ingreso principal desde hoy (reemplaza al anterior). */
  const guardar = (ctx: Contexto) => {
    if (variable) configurarIngresoVariable(ctx);
    else if (regla && monto !== null && monto > 0)
      configurarIngreso(ctx, { concepto: conceptoIngreso(valores.frecuencia), monto, regla });
    else throw new ErrorDominio('ingreso_incompleto', 'faltan datos del ingreso');
  };

  return { hoy, valores, cambiar, variable, proximo, completo, guardar };
}

export type FormularioIngreso = ReturnType<typeof useFormularioIngreso>;

/** Campos de O3. Cada `testID` lleva el `prefijo` (`<prefijo>-frecuencia-quincena`, `<prefijo>-monto`…). */
export function CamposIngreso({ formulario, prefijo }: { formulario: FormularioIngreso; prefijo: string }) {
  const { hoy, valores, cambiar, variable, proximo } = formulario;
  const fechas = proximos14Dias(hoy).map((f) => ({ valor: f, etiqueta: etiquetaFecha(f) }));
  return (
    <>
      <Chips
        testID={`${prefijo}-frecuencia`}
        etiqueta={PREGUNTA_FRECUENCIA}
        opciones={OPCIONES_FRECUENCIA}
        valor={valores.frecuencia}
        alCambiar={(v) => cambiar('frecuencia', v)}
      />

      {variable ? (
        <Texto variante="cuerpo" tono="secundario">
          {TEXTO_INGRESO_VARIABLE}
        </Texto>
      ) : (
        <>
          {valores.frecuencia === 'semanal' ? (
            <Chips
              testID={`${prefijo}-dia-semana`}
              etiqueta={PREGUNTA_DIA_SEMANA}
              opciones={OPCIONES_DIA_SEMANA}
              valor={valores.diaSemana}
              alCambiar={(v) => cambiar('diaSemana', v)}
            />
          ) : null}
          {valores.frecuencia === 'catorcenal' ? (
            <Chips
              testID={`${prefijo}-ancla`}
              etiqueta={PREGUNTA_PROXIMA_VEZ}
              opciones={fechas}
              valor={valores.ancla}
              alCambiar={(v) => cambiar('ancla', v)}
            />
          ) : null}
          {valores.frecuencia === 'mensual' ? (
            <CampoTexto
              testID={`${prefijo}-dia-mes`}
              etiqueta={PREGUNTA_DIA_MES}
              ejemplo={EJEMPLO_DIA_MES}
              teclado="number-pad"
              valor={valores.diaMesTexto}
              alCambiar={(v) => cambiar('diaMesTexto', v)}
              error={
                valores.diaMesTexto !== '' && leerDiaMes(valores.diaMesTexto) === null
                  ? ERROR_DIA_MES
                  : null
              }
            />
          ) : null}
          <CampoMonto
            testID={`${prefijo}-monto`}
            etiqueta={PREGUNTA_MONTO}
            ayuda={AYUDA_MONTO}
            valorInicial={valores.monto}
            alCambiar={(v) => cambiar('monto', v)}
          />
          <Chips
            testID={`${prefijo}-fin-semana`}
            etiqueta={PREGUNTA_FIN_SEMANA}
            opciones={OPCIONES_FIN_DE_SEMANA}
            valor={valores.finDeSemana}
            alCambiar={(v) => cambiar('finDeSemana', v)}
          />
          {proximo ? (
            <Tarjeta testID={`${prefijo}-proximo-pago`}>
              <Texto variante="secundario" tono="secundario">
                {ETIQUETA_PROXIMO_PAGO}
              </Texto>
              <Texto variante="subtitulo">{etiquetaFecha(proximo)}</Texto>
            </Tarjeta>
          ) : null}
        </>
      )}
    </>
  );
}
