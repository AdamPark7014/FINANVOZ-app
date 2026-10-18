import type { Centavos, DiaSemana, ModoFinDeSemana, PlainDate, Regla } from '@cartera/core';
import { proximoPago, type VistaAjustes } from '../../servicios';
import { OPCIONES_DIA_SEMANA, type FinDeSemana, type Frecuencia } from '../onboarding/ingreso';
import {
  lineaResumenIngreso,
  mensajeIngresoGuardado,
  RESUMEN_INGRESO_VARIABLE,
  RESUMEN_SIN_INGRESO,
} from './ingreso-textos';

export { mensajeIngresoGuardado };

/**
 * Ajustes › Ingreso (`02 §12`): las mismas respuestas de O3 (`onboarding/ingreso.ts`) leídas del ingreso guardado,
 * y las frases que lo cuentan en lenguaje llano. Solo presentación: las fechas salen de `proximoPago`.
 */

export interface ValoresIngreso {
  frecuencia: Frecuencia;
  finDeSemana: FinDeSemana;
  diaSemana: DiaSemana | null;
  /** Próxima fecha de pago (cada 14 días). */
  ancla: PlainDate | null;
  /** Día del mes tal como se escribe en el campo. */
  diaMesTexto: string;
  monto: Centavos | null;
}

/** Lo que muestra O3 la primera vez: quincena, "antes" y sin monto. */
export const INGRESO_EN_BLANCO: ValoresIngreso = {
  frecuencia: 'quincena',
  finDeSemana: 'antes',
  diaSemana: null,
  ancla: null,
  diaMesTexto: '',
  monto: null,
};

const FIN_DE_SEMANA: Record<ModoFinDeSemana, FinDeSemana> = {
  anterior: 'antes',
  siguiente: 'despues',
  ninguno: 'mismo',
};

type VistaIngreso = Pick<VistaAjustes, 'ingreso' | 'ingresoVariable'>;

/**
 * Respuestas de O3 que reproducen el ingreso guardado, para cambiarlo sin volver a escribir todo. Una regla que O3
 * no ofrece (días fijos, anual, única) arranca en blanco: así no se guarda otra por accidente.
 */
export function valoresDeIngreso(vista: VistaIngreso, hoy: PlainDate): ValoresIngreso {
  if (vista.ingresoVariable) return { ...INGRESO_EN_BLANCO, frecuencia: 'varia' };
  if (!vista.ingreso) return INGRESO_EN_BLANCO;
  const { regla, monto } = vista.ingreso;
  if (regla.tipo === 'unica') return INGRESO_EN_BLANCO;
  const base = { ...INGRESO_EN_BLANCO, finDeSemana: FIN_DE_SEMANA[regla.ajuste ?? 'ninguno'], monto };
  switch (regla.tipo) {
    case 'quincenal_15_ultimo':
      return { ...base, frecuencia: 'quincena' };
    case 'semanal':
      return { ...base, frecuencia: 'semanal', diaSemana: regla.dia_semana };
    case 'catorcenal':
      // El chip ofrece hoy y los 13 días siguientes: la próxima fecha del ciclo, sin mover por fin de semana.
      return {
        ...base,
        frecuencia: 'catorcenal',
        ancla: proximoPago({ tipo: 'catorcenal', ancla: regla.ancla }, hoy),
      };
    case 'mensual':
      return { ...base, frecuencia: 'mensual', diaMesTexto: String(regla.dia) };
    default:
      return INGRESO_EN_BLANCO;
  }
}

function nombreDia(dia: DiaSemana): string {
  return (OPCIONES_DIA_SEMANA.find((o) => o.valor === dia)?.etiqueta ?? '').toLowerCase();
}

function cuando(regla: Regla): string {
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

/** "Te pagan $13,000 cada quincena, el 15 y el último día del mes. Tu próximo pago: jue 15." */
export function resumenIngreso(vista: VistaIngreso, hoy: PlainDate): string {
  if (vista.ingresoVariable) return RESUMEN_INGRESO_VARIABLE;
  const ingreso = vista.ingreso;
  if (!ingreso) return RESUMEN_SIN_INGRESO;
  const proximo = proximoPago(ingreso.regla, hoy);
  return lineaResumenIngreso(ingreso.monto, cuando(ingreso.regla), proximo);
}
