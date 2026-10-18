import type { Centavos, DiaSemana, PlainDate, Regla } from '@cartera/core';
import { etiquetaFecha } from '../../servicios';
import { formatearCentavos } from '../../ui';
import { OPCIONES_DIA_SEMANA } from '../onboarding/ingreso';

/**
 * Redacción Ajustes › Ingreso (`02 §3`, `02 §12`, `02 §14`): tuteo; montos y fechas vienen de `servicios/` y `ui/`.
 * UI: `SeccionIngreso`, `EditarIngreso`, `FormularioIngreso`; resumen en `ingreso.ts`.
 */

export const SECCION_INGRESO = 'Ingreso';
export const ETIQUETA_CAMBIAR_INGRESO = 'Cambiar mi ingreso';
export const ETIQUETA_CONFIGURAR_INGRESO = 'Decir cada cuándo me pagan';
export const PISTA_CAMBIAR_INGRESO = 'Abre el formulario para cambiar cuánto y cada cuándo te pagan';
export const PISTA_CONFIGURAR_INGRESO = 'Abre el formulario para decir cuánto y cada cuándo te pagan';

export const TITULO_EDITAR = 'Tu ingreso';
export const INTRO_EDITAR =
  'Con esto calculo cuánto puedes gastar cada día hasta tu próximo pago.';

export const ETIQUETA_GUARDAR = 'Guardar';
export const PISTA_GUARDAR = 'Recalculo cuánto puedes gastar con este ingreso';
export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER = 'Sale sin guardar';

export const PREGUNTA_FRECUENCIA = '¿Cada cuándo te pagan?';
export const PREGUNTA_DIA_SEMANA = '¿Qué día te pagan?';
export const PREGUNTA_PROXIMA_VEZ = '¿Cuándo te pagan la próxima vez?';
export const PREGUNTA_DIA_MES = '¿Qué día del mes te pagan?';
export const EJEMPLO_DIA_MES = '30';
export const ERROR_DIA_MES = 'Escribe un día del 1 al 31.';
export const PREGUNTA_MONTO = '¿Cuánto te pagan cada vez?';
export const AYUDA_MONTO = 'Lo que te llega a la cuenta, ya con descuentos.';
export const PREGUNTA_FIN_SEMANA = 'Si cae en fin de semana te pagan:';
export const TEXTO_INGRESO_VARIABLE =
  'Sin problema: calcularé cuánto puedes gastar con los próximos 30 días.';
export const ETIQUETA_PROXIMO_PAGO = 'Tu próximo pago';

export const RESUMEN_SIN_INGRESO = 'Aún no me dices cada cuándo te pagan.';
export const RESUMEN_INGRESO_VARIABLE = 'Tu ingreso varía: reparto tu dinero libre en 30 días.';

function nombreDia(dia: DiaSemana): string {
  return (OPCIONES_DIA_SEMANA.find((o) => o.valor === dia)?.etiqueta ?? '').toLowerCase();
}

/** Fragmento "cada quincena…", "cada viernes", etc., para el resumen de Ajustes › Ingreso. */
export function fraseCuandoTePagan(regla: Regla): string {
  switch (regla.tipo) {
    case 'quincenal_15_ultimo':
      return 'cada quincena, el 15 y el último día del mes';
    case 'quincenal_dias':
      return `los días ${regla.dias[0]} y ${regla.dias[1]} de cada mes`;
    case 'semanal':
      return `cada ${nombreDia(regla.dia_semana)}`;
    case 'catorcenal':
      return 'cada 14 días';
    case 'mensual':
      return `cada mes, el día ${regla.dia}`;
    case 'anual':
      return 'una vez al año';
    case 'unica':
      return 'una sola vez';
  }
}

export function lineaResumenIngreso(monto: Centavos, cuando: string, proximo: PlainDate | null): string {
  const frase = `Te pagan ${formatearCentavos(monto)} ${cuando}.`;
  return proximo ? `${frase} Tu próximo pago: ${etiquetaFecha(proximo)}.` : frase;
}

export const CONFIRMACION_INGRESO_VARIABLE =
  'Listo: como tu ingreso varía, reparto tu dinero libre en 30 días.';
export const CONFIRMACION_INGRESO_SIN_FECHA = 'Listo: guardé tu ingreso.';

export function mensajeIngresoGuardado(variable: boolean, proximo: PlainDate | null): string {
  if (variable) return CONFIRMACION_INGRESO_VARIABLE;
  return proximo
    ? `Listo: guardé tu ingreso. Tu próximo pago es el ${etiquetaFecha(proximo)}.`
    : CONFIRMACION_INGRESO_SIN_FECHA;
}
