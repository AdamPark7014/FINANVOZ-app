import type { Centavos, DiaSemana } from '@cartera/core';
import { normalizarAlias, type LecturaDe } from '@cartera/nlu';
import { capitalizar, RESPUESTAS_PAGO_INICIALES, type RespuestasPago } from '../onboarding/pagos-fijos';

/** Un pago fijo como lo lee el nivel 0 en «O dímelo» (`interpretarPaso('pagos_fijos', …)`, `06 §13`). */
export type PagoLeido = LecturaDe<'pagos_fijos'>['pagos'][number];

/**
 * Lo que llena `FormularioPagoFijo` antes de que la persona lo revise: el chip, el nombre, el monto, cada cuándo,
 * de qué cuenta sale y cuántos pagos faltan. Lo que no se dijo queda vacío (nunca se inventa un día).
 */
export interface PagoPrellenado<C extends string> {
  /** Chip del catálogo si el concepto es uno de ellos; si no, `otro` con el nombre como se dijo. */
  clave: C | 'otro';
  nombre: string;
  monto: Centavos | null;
  respuestas: RespuestasPago;
  /** Cuenta de salida dicha («sale de la BBVA») si existe; `null` = «Lo decido después». */
  cuentaId: string | null;
}

/** Las respuestas de la pantalla que corresponden a la regla dicha. */
function respuestasDeRegla(pago: PagoLeido): RespuestasPago {
  const base: RespuestasPago = {
    ...RESPUESTAS_PAGO_INICIALES,
    ...(pago.frecuencia ? { frecuencia: pago.frecuencia } : {}),
  };
  const regla = pago.regla;
  if (!regla) return base;
  switch (regla.tipo) {
    case 'mensual':
      return { ...base, frecuencia: 'mensual', diaMes: String(regla.dia) };
    case 'anual':
      return { ...base, frecuencia: 'anual', mes: regla.mes, diaMes: String(regla.dia) };
    case 'semanal':
      return { ...base, frecuencia: 'semanal', diaSemana: regla.dia_semana as DiaSemana };
    // Toda quincena va con la regla del 15 y último (la única que ofrece la pantalla).
    case 'quincenal_15_ultimo':
    case 'quincenal_dias':
      return { ...base, frecuencia: 'quincenal' };
    // Sin chip de catorcena: la frecuencia queda por elegir.
    case 'catorcenal':
      return base;
  }
}

/** La cuenta cuyo nombre es el alias dicho («la BBVA» → BBVA); si no hay una sola, se decide después. */
function cuentaDeAlias(
  alias: string | undefined,
  cuentas: readonly { id: string; nombre: string }[],
): string | null {
  if (alias === undefined) return null;
  const buscado = normalizarAlias(alias);
  const iguales = cuentas.filter((c) => normalizarAlias(c.nombre) === buscado);
  return iguales.length === 1 ? (iguales[0]?.id ?? null) : null;
}

/** Traduce un pago leído a lo que muestra el formulario; `cuentas` son las que ofrece «¿De dónde sale?». */
export function prellenadoDePagoLeido<C extends string>(
  pago: PagoLeido,
  sugeridos: readonly { readonly clave: C; readonly concepto: string }[],
  cuentas: readonly { id: string; nombre: string }[] = [],
): PagoPrellenado<C> {
  const sugerido = sugeridos.find((s) => s.concepto === pago.concepto.toLowerCase());
  const restantes = pago.pagosRestantes;
  return {
    clave: sugerido ? sugerido.clave : 'otro',
    nombre: capitalizar(sugerido ? sugerido.concepto : pago.concepto),
    monto: pago.monto.monto,
    respuestas: {
      ...respuestasDeRegla(pago),
      pagosRestantes: restantes !== undefined && restantes <= 999 ? String(restantes) : '',
    },
    cuentaId: cuentaDeAlias(pago.cuentaAlias, cuentas),
  };
}
