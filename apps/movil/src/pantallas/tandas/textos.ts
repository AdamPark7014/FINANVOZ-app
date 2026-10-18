import type { FrecuenciaTanda, MovimientoTanda, TandaYaEmpezada } from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Copy de tandas (`02 §18`, tuteo). */
export const OPCIONES_FRECUENCIA_TANDA: readonly { valor: FrecuenciaTanda; etiqueta: string }[] = [
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'quincenal', etiqueta: 'Cada quincena (15 y último)' },
  { valor: 'catorcenal', etiqueta: 'Cada 14 días' },
  { valor: 'mensual', etiqueta: 'Cada mes' },
];

/** "No es ingreso, y lo dice" (`02 §18`). */
export const TEXTO_NO_ES_INGRESO = 'Esto es tu dinero de vuelta, no un ingreso.';

/** Lista de tandas vacía (`02 §18`). */
export const TEXTO_TANDAS_VACIO =
  'Agrega tu tanda y aparto cada aportación el día que toca.';

export const textoAportado = (centavos: number) => `Llevas ${formatearCentavos(centavos)} aportados`;
export const textoEnRiesgo = (centavos: number) =>
  `Si la tanda se cae, arriesgas ${formatearCentavos(centavos)}`;
export const textoPorAportar = (centavos: number) => `Te faltan ${formatearCentavos(centavos)} por aportar`;

/** "Llevas 6 aportaciones y ya cobraste: te faltan 4 ($2,000)" (E11-03). */
export function textoYaEmpezo(y: TandaYaEmpezada): string {
  const llevas =
    y.aportacionesHechas === 1 ? 'Llevas 1 aportación' : `Llevas ${y.aportacionesHechas} aportaciones`;
  const cobro = y.yaCobraste ? ' y ya cobraste' : '';
  return `${llevas}${cobro}: te faltan ${y.faltan} (${formatearCentavos(y.porAportar)})`;
}

export const mensajeAportacion = (m: MovimientoTanda) =>
  `Registré: diste tu tanda ${formatearCentavos(m.monto)} · ${m.cuenta}`;

export const mensajeCobro = (m: MovimientoTanda) =>
  `Registré: cobraste tu tanda ${formatearCentavos(m.monto)} · ${m.cuenta}. ${TEXTO_NO_ES_INGRESO}`;
